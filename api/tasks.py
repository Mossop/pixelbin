import subprocess
import json

from celery import shared_task
from django.db import transaction
from PIL import Image

from .models import Media
from .media import resize, THUMB_SIZES

PROCESS_VERSION = 1

@shared_task
@transaction.atomic
def process_media(media_id):
    # pylint: disable=bare-except
    media = Media.objects.select_for_update().get(id=media_id)
    process(media)
    media.save()

def process_image(media, image):
    media.width = image.width
    media.height = image.height
    for size in THUMB_SIZES:
        resized = resize(image, size)
        target = media.storage.get_local_path('sized%d.jpg' % (size))
        resized.save(target, None, quality=95, optimize=True)

def initial_import(media):
    meta_path = media.storage.get_local_path('metadata.json')
    source = media.storage.get_temp_path(media.storage_filename)
    result = subprocess.run(['exiftool', '-n', '-json', source],
                            capture_output=True, timeout=10, check=True)
    results = json.loads(result.stdout)
    if len(results) != 1:
        metadata = {}
    else:
        metadata = results[0]

    meta_file = open(meta_path, 'w')
    json.dump(metadata, meta_file, indent=2)
    meta_file.close()

    media.storage.store_storage_from_temp(media.storage_filename)

    if media.is_image:
        process_image(media, Image.open(source))
    elif media.is_video:
        tmp = media.storage.get_temp_path('tmp.jpg')
        args = [
            'ffmpeg',
            '-y',
            '-i', source,
            '-frames:v', '1',
            '-q:v', '3',
            '-f', 'singlejpeg',
            '-y',
            tmp,
        ]
        subprocess.run(args, timeout=10, check=True)
        process_image(media, Image.open(tmp))

        target = media.storage.get_temp_path('h264.mp4')
        args = [
            'ffmpeg',
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

        target = media.storage.get_temp_path('vp9.mp4')
        logroot = media.storage.get_temp_path('ffmpeg2pass')
        args = [
            'ffmpeg',
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
        subprocess.run(args, check=True)
        args = [
            'ffmpeg',
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

    return metadata

def process(media):
    if media.process_version and media.process_version == PROCESS_VERSION:
        return

    # This is the first process, generate the thumbnails and metadata.
    if media.process_version is None:
        metadata = initial_import(media)
    else:
        meta_path = media.storage.get_local_path('metadata.json')
        meta_file = open(meta_path, 'r')
        metadata = json.load(meta_file)
        meta_file.close()

    media.metadata.import_from_media(metadata)
    media.process_version = PROCESS_VERSION
    media.storage.delete_all_temp()
