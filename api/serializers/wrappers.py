import logging

from rest_framework.response import Response
from rest_framework import relations

from .. import serializers
from . import typedefs

LOGGER = logging.getLogger(__name__)

class SerializerWrapper:
    def __init__(self, serializer):
        self.serializer = serializer

    def build_serializer(self, *args, **kwargs):
        return self.serializer(*args, **kwargs)

    def build_request_serializer(self, *args, data=None, **kwargs):
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.build_request_serializer(*args, data=data, **kwargs)

        deserialized = self.build_serializer(*args, data=data, **kwargs)
        deserialized.is_valid(raise_exception=True)
        return deserialized

    def build_response_serializer(self, instance, *args, **kwargs):
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.build_response_serializer(instance, *args, **kwargs)

        deserialized = self.build_serializer(instance, *args, **kwargs)
        return deserialized

    def handle_request(self, request, data, func, *args, **kwargs):
        deserialized = self.build_request_serializer(data=data)
        return func(request, deserialized, *args, **kwargs)

    def handle_response(self, result):
        return Response(self.build_response_serializer(result).data)

    def typedef(self):
        if isinstance(self.serializer, type):
            return typedefs.derive_type_from_class(self.serializer)
        return typedefs.derive_type_from_instance(self.serializer)

class BlobSerializer(SerializerWrapper):
    def __init__(self):
        super().__init__(None)

    def typedef(self):
        return typedefs.BlobType()

class PatchSerializerWrapper(SerializerWrapper):
    def __init__(self, serializer):
        if not issubclass(serializer, serializers.ModelSerializer):
            raise Exception('Can only create a patch serializer for a model serializer.')
        super().__init__(serializer)

    def build_request_serializer(self, *args, data=None, **kwargs):
        if data is not None:
            data = data.copy()
        id_serializer = build_id_serializer(self.serializer.Meta.model)(data=data)
        id_serializer.is_valid(raise_exception=True)
        instance = id_serializer.validated_data['id']
        del data['id']

        return super().build_request_serializer(instance, *args, data=data, partial=True, **kwargs)

    def build_response_serializer(self, *args, data=None, **kwargs):
        raise Exception('Patch serializers cannot be used in response.')

    def typedef(self):
        return typedefs.PatchType(super().typedef(), self.serializer.Meta.model)

class MultipartSerializerWrapper(SerializerWrapper):
    def typedef(self):
        return typedefs.FormDataType(super().typedef())

class ListSerializerWrapper(SerializerWrapper):
    def build_serializer(self, *args, **kwargs):
        return super().build_serializer(*args, many=True, **kwargs)

    def typedef(self):
        return typedefs.ArrayType(super().typedef())

def build_id_serializer(model):
    class IdSerializer(serializers.Serializer):
        id = relations.PrimaryKeyRelatedField(queryset=model.objects.all(), allow_null=False)

        class Meta:
            js_response_type = 'Mappable'
    return IdSerializer

class ModelIdQuery(SerializerWrapper):
    def __init__(self, model):
        super().__init__(build_id_serializer(model))

    def handle_request(self, request, data, func, *args, **kwargs):
        def callback(req, des, *args, **kwargs):
            return func(req, des.validated_data['id'], *args, **kwargs)

        return super().handle_request(request, data, callback, *args, **kwargs)
