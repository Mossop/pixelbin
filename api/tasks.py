import subprocess
import json
from datetime import datetime

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

def process_image(media, image):
    media.width = image.width
    media.height = image.height
    for size in THUMB_SIZES:
        resized = resize(image, size)
        target = media.storage.get_local_path('sized%d.jpg' % (size))
        resized.save(target, None, quality=95, optimize=True)

def parse_exif_date(date):
    return datetime.strptime(date, '%Y:%m:%d %H:%M:%S')

def parse_exif_subsec_date(date):
    return datetime.strptime(date, '%Y:%m:%d %H:%M:%S.%f')

def parse_metadata(metadata, spec, default=None):
    for [key, parser] in spec:
        if key in metadata:
            return parser(metadata[key])
    return default

def straight(data):
    return data

def rotate(value):
    while value < 0:
        value += 360

    if value == 0:
        return 1
    if value == 90:
        return 6
    if value == 180:
        return 3
    if value == 270:
        return 8

def import_metadata(media, metadata):
    media.media_title = parse_metadata(metadata, [
        ['Title', straight],
    ])

    media.media_taken = parse_metadata(metadata, [
        ['SubSecDateTimeOriginal', parse_exif_subsec_date],
        ['SubSecCreateDate', parse_exif_subsec_date],
        ['DateTimeOriginal', parse_exif_date],
        ['CreateDate', parse_exif_date],
        ['DateTimeCreated', parse_exif_date],
        ['DigitalCreationDateTime', parse_exif_date],
    ])

    media.media_longitude = parse_metadata(metadata, [
        ['GPSLongitude', float],
    ])
    media.media_latitude = parse_metadata(metadata, [
        ['GPSLatitude', float],
    ])

    # Orientation is handled automatically for videos.
    if not media.is_video:
        media.media_orientation = parse_metadata(metadata, [
            ['Orientation', int],
            ['Rotation', rotate],
        ], 1)

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
            tmp,
        ]
        result = subprocess.run(args, timeout=10, check=True)
        process_image(media, Image.open(tmp))

    media.storage.delete_all_temp()
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

    with transaction.atomic():
        import_metadata(media, metadata)
        media.process_version = PROCESS_VERSION
        media.save()
