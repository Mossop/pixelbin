import os
from base.utils import CONFIG, path

from .base import LocalFileStore

class ServerFileStore(LocalFileStore):
    STORAGE = None

    @classmethod
    def build(cls):
        if cls.STORAGE is None:
            cls.STORAGE = ServerFileStore()
        return cls.STORAGE

    def storage_root(self):
        return os.path.join(path(CONFIG.get('path', 'data')), 'storage', 'server')
