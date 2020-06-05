from PIL import Image

from .storage.base import BaseFileStore

ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'video/mp4',
    'video/x-m4v',
    'video/x-matroska',
    'video/webm',
    'video/quicktime',
    'video/mpeg',
]

def is_image(mimetype: str) -> bool:
    return mimetype[0:6] == 'image/'

def is_video(mimetype: str) -> bool:
    return mimetype[0:6] == 'video/'

THUMB_SIZES = [
    150,
    200,
    300,
    400,
    500,
]

def resize(image: Image, size: int) -> Image:
    if image.width <= size and image.height <= size:
        return image.copy()
    if image.width > image.height:
        factor = size / image.width
        return image.resize((size, round(image.height * factor)), Image.LANCZOS)
    factor = size / image.height
    return image.resize((round(image.width * factor), size), Image.LANCZOS)

def build_thumbnail(file_store: BaseFileStore, size: int) -> Image:
    for thumbsize in THUMB_SIZES:
        if thumbsize >= size:
            path = file_store.local.get_path('sized%d.jpg' % (thumbsize))
            image = Image.open(path)
            return resize(image, size)

    thumbsize = THUMB_SIZES[-1]
    path = file_store.local.get_path('sized%d.jpg' % (thumbsize))
    image = Image.open(path)
    return resize(image, size)
