import subprocess
import json

from celery import shared_task
from celery.utils.log import get_task_logger
from django.db import transaction
from PIL import Image

from .models import Media
from .media import resize, THUMB_SIZES

from .metadata import parse_metadata

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
def process_media(media_id):
    # pylint: disable=bare-except
    media = Media.objects.select_for_update().get(id=media_id)
    logger = MediaLogger(media)

    try:
        logger.info('Processing media "%s"...', media.id)
        process(logger, media)
    except:
        logger.exception('Failed while processing media "%s".', media.id)
        raise
    logger.info('Processing of media "%s" is complete.', media.id)

def process_image(logger, media, source):
    image = Image.open(source)
    for size in THUMB_SIZES:
        logger.debug('Building thumbnail of size %d.', size)
        resized = resize(image, size)
        target = media.storage.get_local_path('sized%d.jpg' % (size))
        resized.save(target, None, quality=95, optimize=True)

def process_video(logger, media, source):
    logger.info('Generating video frame.')
    tmp = media.storage.get_temp_path('tmp.jpg')
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
    target = media.storage.get_temp_path('h264.mp4')
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
    media.storage.store_storage_from_temp('h264.mp4')

    logger.info('Encoding video using vp9 codec. Pass 1.')
    target = media.storage.get_temp_path('vp9.mp4')
    logroot = media.storage.get_temp_path('ffmpeg2pass')
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
    media.storage.store_storage_from_temp('vp9.mp4')

def import_file(logger, media):
    logger.info('Importing new media file.')
    meta_path = media.storage.get_local_path('metadata.json')
    source = media.storage.get_temp_path(media.storage_filename)
    result = subprocess.run(['exiftool', '-n', '-json', source],
                            capture_output=True, timeout=10, check=True)
    results = json.loads(result.stdout)
    if len(results) != 1:
        metadata = {}
    else:
        metadata = results[0]

    metadata['FileName'] = media.metadata.get_media_value('filename')

    meta_file = open(meta_path, 'w')
    json.dump(metadata, meta_file, indent=2)
    meta_file.close()

    media.storage.store_storage_from_temp(media.storage_filename)

    mimetype = metadata.get('MIMEType', None)
    if mimetype is not None:
        media.mimetype = mimetype

    if media.is_image:
        process_image(logger, media, source)
    elif media.is_video:
        process_video(logger, media, source)

    return metadata

def process(logger, media):
    if media.process_version == PROCESS_VERSION and not media.new_file:
        return

    # There is a new file, generate the thumbnails.
    if media.new_file:
        metadata = import_file(logger, media)
    else:
        logger.info('Loading cached metadata.')
        meta_path = media.storage.get_local_path('metadata.json')
        with open(meta_path, 'r') as meta_file:
            metadata = json.load(meta_file)

    logger.info('Parsing metadata.')

    media.file_size = parse_metadata(metadata, ['FileSize'])
    media.duration = parse_metadata(metadata, ['Duration'])
    media.width = parse_metadata(metadata, ['ImageWidth'])
    media.height = parse_metadata(metadata, ['ImageHeight'])

    media.metadata.import_from_media(metadata)
    media.process_version = PROCESS_VERSION
    media.new_file = False
    media.save()

    media.storage.delete_all_temp()
