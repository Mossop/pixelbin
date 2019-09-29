class Storage(object):
    def __init__(self, media):
        pass

    def store_file(self, path):
        pass

    def get_full_url(self):
        pass

    def get_thumbnail_url(self, size):
        pass

    def delete(self):
        pass

def get_storage(media):
    storage_type = media.catalog.storage
    if storage_type == 'backblaze':
        from .backblaze import BackblazeStorage
        return BackblazeStorage(media)
    return Storage(media)
