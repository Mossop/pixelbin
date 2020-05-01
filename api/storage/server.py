import os

from django.conf import settings

from base.config import PATHS

from .base import BaseFileStore, LocalStorageArea

class MediaStorageArea(LocalStorageArea):
    def __init__(self, path):
        self._path = path
        super().__init__(os.path.join(PATHS.get('media'), path))

    def get_url(self, path):
        return os.path.join(settings.MEDIA_URL[0:-1], self._path, path)

class ServerFileStore(BaseFileStore):
    STORAGE = None

    @classmethod
    def build(cls, model): # pylint: disable=unused-argument
        if cls.STORAGE is None:
            cls.STORAGE = ServerFileStore()
        return cls.STORAGE

    def __init__(self):
        super().__init__(
            LocalStorageArea(os.path.join(PATHS.get('data'), 'storage', 'temp')),
            LocalStorageArea(os.path.join(PATHS.get('data'), 'storage', 'local')),
            MediaStorageArea('storage'),
        )
