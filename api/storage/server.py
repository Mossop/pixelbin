import os

from base.config import PATHS

from .base import BaseFileStore, LocalStorageArea

class ServerFileStore(BaseFileStore):
    STORAGE = None

    @classmethod
    def build(cls):
        if cls.STORAGE is None:
            cls.STORAGE = ServerFileStore()
        return cls.STORAGE

    def __init__(self):
        super().__init__(
            LocalStorageArea(os.path.join(PATHS.get('data'), 'storage', 'temp')),
            LocalStorageArea(os.path.join(PATHS.get('data'), 'storage', 'local')),
            LocalStorageArea(os.path.join(PATHS.get('data'), 'storage', 'main')),
        )
