import os
from base.utils import CONFIG, path

from . import FileStorage

class ServerStorage(FileStorage):
    STORAGE = None

    @classmethod
    def build(cls):
        if cls.STORAGE is None:
            cls.STORAGE = ServerStorage()
        return cls.STORAGE

    def storage_root(self):
        return os.path.join(path(CONFIG.get('path', 'data')), 'storage', 'server')
