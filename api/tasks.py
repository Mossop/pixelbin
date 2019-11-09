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
    try:
        media = Media.objects.select_for_update().get(id=media_id)
        process(media)
        media.save()
    except:
        media.storage.delete_all_temp()

def process(media):
    if media.process_version and media.process_version == PROCESS_VERSION:
        return

    source = media.storage.get_temp_path(media.storage_filename)
    result = subprocess.run(['exiftool', '-json', source], capture_output=True,
                            timeout=10, check=True)
    metadata = json.loads(result.stdout)
    if len(metadata) != 1:
        return
    media.import_metadata(metadata[0])
    meta_file = media.storage.get_local_path('metadata.json')
    output = open(meta_file, 'w')
    json.dump(metadata[0], output, indent=2)
    output.close()

    media.storage.store_storage_from_temp(media.storage_filename)

    if media.is_image:
        image = Image.open(source)
        media.width = image.width
        media.height = image.height
        for size in THUMB_SIZES:
            resized = resize(image, size)
            target = media.storage.get_local_path('sized%d.jpg' % (size))
            resized.save(target, None, quality=95, optimize=True)
    elif media.is_video:
        tmp = media.storage.get_temp_path('tmp.jpg')
        args = [
            'ffmpeg',
            '-y',
            '-i', source,
            '-frames:v', '1',
            '-q:v', '3',
            '-f', 'singlejpeg',
            tmp,
        ]
        result = subprocess.run(args, timeout=10, check=True)
        image = Image.open(tmp)
        media.width = image.width
        media.height = image.height
        for size in THUMB_SIZES:
            resized = resize(image, size)
            target = media.storage.get_local_path('sized%d.jpg' % (size))
            resized.save(target, None, quality=95, optimize=True)

    media.process_version = PROCESS_VERSION
    media.storage.delete_all_temp()
