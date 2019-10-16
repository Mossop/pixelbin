from django.conf import settings

from . import FileStorage

class ServerStorage(FileStorage):
    STORAGE = None

    @classmethod
    def build(cls):
        if cls.STORAGE is None:
            cls.STORAGE = ServerStorage()
        return cls.STORAGE

    def private_root(self):
        return '%s/%s' % (settings.MEDIA_ROOT, 'private')

    def temp_root(self):
        return '%s/%s' % (settings.MEDIA_ROOT, 'temp')

    def public_root(self):
        return '%s/%s' % (settings.MEDIA_ROOT, 'storage')
