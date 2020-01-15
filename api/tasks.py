import subprocess
import json
from datetime import datetime

from celery import shared_task
from celery.utils.log import get_task_logger
from django.db import transaction
from PIL import Image
from filetype import filetype

from .models import Media
from .media import resize, THUMB_SIZES, ALLOWED_TYPES, is_video, is_image

from .metadata import parse_metadata, parse_iso_datetime

base_logger = get_task_logger(__name__)

PROCESS_VERSION = 1

class MediaLogger:
    def __init__(self, media):
        self.id = media.id

    def _build_message(self, message):
        return '[%s] %s' % (self.id, message)

    def debug(self, message, *args, **kwargs):
        base_logger.debug(self._build_message(message), *args, **kwargs)

    def info(self, message, *args, **kwargs):
        base_logger.info(self._build_message(message), *args, **kwargs)

    def exception(self, message, *args, **kwargs):
        base_logger.exception(self._build_message(message), *args, **kwargs)

@shared_task
@transaction.atomic
def process_metadata(media_id):
    # pylint: disable=bare-except
    media = Media.objects.select_for_update().get(id=media_id)
    logger = MediaLogger(media)

    if media.process_version == PROCESS_VERSION:
        logger.info('Skipping processing for already processed media "%s".' % media.id)
        return

    try:
        logger.info('Processing metadata for media "%s"...', media.id)
        meta_path = media.file_store.get_local_path('metadata.json')
        with open(meta_path, 'r') as meta_file:
            metadata = json.load(meta_file)

        import_metadata(logger, media, metadata)
        media.save()
    except:
        logger.exception('Failed while processing metadata for media "%s".', media.id)
        raise
    logger.info('Processing of metadata for media "%s" is complete.', media.id)

@shared_task
@transaction.atomic
def process_new_file(media_id, target_name=None):
    # pylint: disable=bare-except
    media = Media.objects.select_for_update().get(id=media_id)
    logger = MediaLogger(media)

    if not media.new_file:
        logger.info('Skipping new file for already processed media "%s".' % media.id)
        return

    try:
        logger.info('Processing new file for media "%s"...', media.id)
        metadata = import_file(logger, media, target_name)
        if metadata is not None:
            import_metadata(logger, media, metadata)
        media.new_file = False
        media.save()

        media.file_store.delete_all_temp()
    except:
        logger.exception('Failed while processing new file for media "%s".', media.id)
        raise
    logger.info('Processing of new file for media "%s" is complete.', media.id)

def process_image(logger, media, source):
    image = Image.open(source)
    for size in THUMB_SIZES:
        logger.debug('Building thumbnail of size %d.', size)
        resized = resize(image, size)
        target = media.file_store.get_local_path('sized%d.jpg' % (size))
        resized.save(target, None, quality=95, optimize=True)

def process_video(logger, media, source):
    logger.info('Generating video frame.')
    tmp = media.file_store.get_temp_path('tmp.jpg')
    args = [
        'ffmpeg',
        '-y',
        '-loglevel', 'warning',
        '-i', source,
        '-frames:v', '1',
        '-q:v', '3',
        '-f', 'singlejpeg',
        '-y',
        tmp,
    ]
    subprocess.run(args, timeout=10, check=True)
    process_image(logger, media, tmp)

    logger.info('Encoding video using h264 codec.')
    target = media.file_store.get_temp_path('h264.mp4')
    args = [
        'ffmpeg',
        '-loglevel', 'warning',
        '-i', source,
        '-vcodec', 'h264',
        '-acodec', 'aac',
        '-profile:v', 'high',
        '-level', '5.1',
        '-strict',
        '-2',
        '-y',
        target,
    ]
    subprocess.run(args, check=True)
    media.file_store.store_storage_from_temp('h264.mp4')

    logger.info('Encoding video using vp9 codec. Pass 1.')
    target = media.file_store.get_temp_path('vp9.mp4')
    logroot = media.file_store.get_temp_path('ffmpeg2pass')
    args = [
        'ffmpeg',
        '-loglevel', 'warning',
        '-i', source,
        '-vcodec', 'libvpx-vp9',
        '-b:v', '2M',
        '-pass', '1',
        '-passlogfile', logroot,
        '-an',
        '-pix_fmt', 'yuv420p',
        '-f', 'mp4',
        '-y',
        '/dev/null',
    ]
    logger.info('Encoding video using vp9 codec. Pass 2.')
    subprocess.run(args, check=True)
    args = [
        'ffmpeg',
        '-loglevel', 'warning',
        '-i', source,
        '-vcodec', 'libvpx-vp9',
        '-b:v', '2M',
        '-pass', '2',
        '-passlogfile', logroot,
        '-pix_fmt', 'yuv420p',
        '-acodec', 'libvorbis',
        '-f', 'mp4',
        '-y',
        target,
    ]
    subprocess.run(args, check=True)
    media.file_store.store_storage_from_temp('vp9.mp4')

def import_file(logger, media, target_name):
    logger.info('Importing new media file.')
    meta_path = media.file_store.get_local_path('metadata.json')
    source = media.file_store.get_temp_path('original')
    result = subprocess.run(['exiftool', '-n', '-json', source],
                            capture_output=True, timeout=10, check=True)
    results = json.loads(result.stdout)
    if len(results) != 1:
        logger.error('Unable to load the file\'s metadata. Abandoning this file.')
        return None
    metadata = results[0]

    mimetype = metadata.get('MIMEType', None)
    if mimetype is None:
        logger.error('No mimetype detected. Abandoning this file.')
        return None
    if mimetype not in ALLOWED_TYPES:
        logger.error('Invalid mimetype detected (%s). Abandoning this file.' % mimetype)
        return None

    if target_name is None:
        kind = filetype.get_type(mime=mimetype)
        if kind is not None:
            extension = kind.extension
        else:
            extension = ''
        target_name = 'original%s' % extension
    metadata['FileName'] = target_name
    metadata['FileUploadDate'] = datetime.now().isoformat()

    if is_image(mimetype):
        process_image(logger, media, source)
    elif is_video(mimetype):
        process_video(logger, media, source)

    media.file_store.store_storage_from_temp('original', target_name)

    meta_file = open(meta_path, 'w')
    json.dump(metadata, meta_file, indent=2)
    meta_file.close()

    return metadata

def import_metadata(logger, media, metadata):
    logger.info('Parsing metadata.')

    media.mimetype = parse_metadata(metadata, ['MIMEType'])
    media.file_size = parse_metadata(metadata, ['FileSize'])
    media.duration = parse_metadata(metadata, ['Duration'])
    media.width = parse_metadata(metadata, ['ImageWidth'])
    media.height = parse_metadata(metadata, ['ImageHeight'])
    media.uploaded = parse_metadata(metadata, [
        ['FileUploadDate', parse_iso_datetime],
    ])

    media.metadata.import_from_media(metadata)
    media.process_version = PROCESS_VERSION
