from __future__ import annotations

import os
from typing import TYPE_CHECKING

from django.conf import settings

from base.config import PATHS

from .base import BaseFileStore, FileStorageArea

if TYPE_CHECKING:
    from .models import Server

class MediaStorageArea(FileStorageArea):
    def __init__(self, path: str) -> None:
        self._path = path
        super().__init__(os.path.join(PATHS.get('media'), path))

    def get_url(self, path: str) -> str:
        return os.path.join(settings.MEDIA_URL[0:-1], self._path, path)

class ServerFileStore(BaseFileStore):
    STORAGE = None

    @classmethod
    def build(cls, model: Server) -> ServerFileStore: # pylint: disable=unused-argument
        if cls.STORAGE is None:
            cls.STORAGE = ServerFileStore()
        return cls.STORAGE

    def __init__(self) -> None:
        super().__init__(
            FileStorageArea(os.path.join(PATHS.get('data'), 'storage', 'temp')),
            FileStorageArea(os.path.join(PATHS.get('data'), 'storage', 'local')),
            MediaStorageArea('storage'),
        )
