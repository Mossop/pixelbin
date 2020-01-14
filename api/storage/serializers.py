from rest_framework import serializers

from ..serializers import ModelSerializer, FieldMixin, UnionType, derive_type_from_class
from .models import Server, Backblaze, STORAGE_MODELS

class ServerSerializer(ModelSerializer):
    class Meta:
        js_request_type = 'ServerStorageData'
        model = Server
        fields = ['type']

class BackblazeSerializer(ModelSerializer):
    keyId = serializers.CharField(write_only=True, source='key_id')

    class Meta:
        js_request_type = 'BackblazeStorageData'
        model = Backblaze
        fields = ['type', 'keyId', 'key', 'bucket', 'path']

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
