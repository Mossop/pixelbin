from PIL import Image

THUMB_SIZES = [
    150,
    200,
    300,
    400,
    500,
]

def resize(image, size):
    if image.width <= size and image.height <= size:
        return image.copy()
    if image.width > image.height:
        factor = size / image.width
        return image.resize((size, round(image.height * factor)), Image.LANCZOS)
    factor = size / image.height
    return image.resize((round(image.width * factor), size), Image.LANCZOS)

def build_thumbnail(media, size):
    for thumbsize in THUMB_SIZES:
        if thumbsize >= size:
            path = media.storage.get_local_path('sized%d.jpg' % (thumbsize))
            image = Image.open(path)
            return resize(image, size)

    thumbsize = THUMB_SIZES[-1]
    path = media.storage.get_local_path('sized%d.jpg' % (thumbsize))
    image = Image.open(path)
    return resize(image, size)
