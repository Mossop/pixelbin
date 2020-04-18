import logging

from rest_framework.response import Response
from rest_framework import relations

from .. import serializers
from . import typedefs

LOGGER = logging.getLogger(__name__)

class SerializerWrapper:
    def __init__(self, serializer):
        self.serializer = serializer

    def build_serializer(self, **kwargs):
        return self.serializer(**kwargs)

    def build_request_serializer(self, **kwargs):
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.build_request_serializer(**kwargs)

        deserialized = self.build_serializer(**kwargs)
        deserialized.is_valid(raise_exception=True)
        return deserialized

    def build_response_serializer(self, instance):
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.build_response_serializer(instance)

        deserialized = self.build_serializer(instance=instance)
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

    def build_response_serializer(self, instance):
        raise Exception('Patch serializers cannot be used in response.')

    def handle_request(self, request, data, func, *args, **kwargs):
        id_serializer = build_id_serializer(self.serializer.Meta.model)(data={
            'id': kwargs.pop('id', None),
        })
        id_serializer.is_valid(raise_exception=True)
        instance = id_serializer.validated_data['id']

        deserialized = self.build_request_serializer(instance=instance, data=data, partial=True)
        return func(request, deserialized, *args, **kwargs)

    def typedef(self):
        return typedefs.PatchType(super().typedef(), self.serializer.Meta.model)

class DelegatedSerializerWrapper(SerializerWrapper):
    def handle_request(self, request, data, func, *args, **kwargs):
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.handle_request(request, data, func, *args, **kwargs)
        return super().handle_request(request, data, func, *args, **kwargs)

    def handle_response(self, result):
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.handle_response(result)
        return super().handle_response(result)

class MultipartSerializerWrapper(DelegatedSerializerWrapper):
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

        return super().handle_request(request, {
            'id': kwargs.pop('id', None),
        }, callback, *args, **kwargs)
