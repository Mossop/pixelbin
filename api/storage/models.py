from django.db import models
from rest_framework import status as http_status

from ..utils import ApiException

class Storage(models.Model):
    @property
    def inner(self):
        for model in STORAGE_MODELS:
            try:
                return getattr(self, model.__name__.lower())
            except model.DoesNotExist:
                pass

        raise ApiException('illegal-storage', status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

    @property
    def file_store(self):
        return self.inner.file_store

class Server(Storage):
    type = 'server'

    @classmethod
    def serializer(cls):
        # pylint: disable=import-outside-toplevel
        from .serializers import ServerSerializer
        return ServerSerializer

    @property
    def file_store(self):
        # pylint: disable=import-outside-toplevel
        from .server import ServerStorage
        return ServerStorage.build()

class Backblaze(Storage):
    type = 'backblaze'

    key_id = models.CharField(max_length=30)
    key = models.CharField(max_length=40)
    bucket = models.CharField(max_length=50)
    path = models.CharField(max_length=200)

    @classmethod
    def serializer(cls):
        # pylint: disable=import-outside-toplevel
        from .serializers import BackblazeSerializer
        return BackblazeSerializer

    @property
    def file_store(self):
        # pylint: disable=import-outside-toplevel
        from .backblaze import BackblazeStorage
        return BackblazeStorage.build(self)

STORAGE_MODELS = [Server, Backblaze]
