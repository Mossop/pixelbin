from django.db import models
from rest_framework import status as http_status, serializers

from ..serializers import ModelSerializer, FieldMixin, UnionType, derive_type_from_class
from ..utils import ApiException

class Storage(models.Model):
    _file_store = None

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
        if self._file_store is None:
            self._file_store = self.inner.build_file_store()
        return self._file_store

class Server(Storage):
    type = 'server'

    @classmethod
    def serializer(cls):
        return ServerSerializer

    def build_file_store(self):
        # pylint: disable=import-outside-toplevel
        from .server import ServerFileStore
        return ServerFileStore.build()

class ServerSerializer(ModelSerializer):
    class Meta:
        js_request_type = 'ServerStorageData'
        model = Server
        fields = ['type']

class Backblaze(Storage):
    type = 'backblaze'

    key_id = models.CharField(max_length=30)
    key = models.CharField(max_length=40)
    bucket = models.CharField(max_length=50)
    path = models.CharField(max_length=200)

    @classmethod
    def serializer(cls):
        return BackblazeSerializer

    def build_file_store(self):
        # pylint: disable=import-outside-toplevel
        from .backblaze import BackblazeFileStore
        return BackblazeFileStore.build(self)

class BackblazeSerializer(ModelSerializer):
    keyId = serializers.CharField(write_only=True, source='key_id')

    class Meta:
        js_request_type = 'BackblazeStorageData'
        model = Backblaze
        fields = ['type', 'keyId', 'key', 'bucket', 'path']

STORAGE_MODELS = [Server, Backblaze]

def serializer_for_data(data):
    if 'type' in data and isinstance(data['type'], str):
        for model in STORAGE_MODELS:
            if getattr(model, 'type') == data['type']:
                return model.serializer()(data=data)

    msg = 'Storage type "%s" is unknown.'
    raise serializers.ValidationError(msg % data['type'])

class StorageField(serializers.Field, FieldMixin):
    @classmethod
    def typedef(cls):
        return UnionType(map(lambda c: derive_type_from_class(c.serializer()), STORAGE_MODELS))

    def to_internal_value(self, data):
        serializer = serializer_for_data(data)
        serializer.is_valid(raise_exception=True)
        return serializer

    def to_representation(self, value):
        inner = value.inner
        serializer = inner.serializer()(inner)
        return serializer.data
