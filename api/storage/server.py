import os

from django.conf import settings

from base.utils import CONFIG, path

from . import FileStorage

class ServerStorage(FileStorage):
    STORAGE = None

    @classmethod
    def build(cls):
        if cls.STORAGE is None:
            cls.STORAGE = ServerStorage()
        return cls.STORAGE

    def public_root(self):
        return os.path.join(settings.MEDIA_ROOT, 'storage', 'public')

    def public_root_url(self):
        return '%s/storage/public' % (settings.MEDIA_URL)

    def private_root(self):
        return os.path.join(path(CONFIG.get('path', 'data')), 'storage', 'private')

    def get_private_url(self, media, name):
        return None
