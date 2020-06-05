from __future__ import annotations

import logging
from typing import Any, Callable, Type, Union, Mapping

from django.db.models import Model
from rest_framework.response import Response
from rest_framework import relations
from rest_framework.request import Request
from rest_framework.serializers import Serializer

from .. import serializers
from . import typedefs
from ..models.base import ModelWithId

LOGGER = logging.getLogger(__name__)

class SerializerWrapper:
    def __init__(self, serializer: Union[SerializerWrapper, Type[Serializer]]) -> None:
        self.serializer = serializer

    def build_serializer(self, **kwargs) -> Serializer:
        if isinstance(self.serializer, SerializerWrapper):
            raise Exception(
                'Unexpected attempt to instantiate "%s".' % self.serializer.__class__.__name__
            )
        return self.serializer(**kwargs)

    def build_request_serializer(self, **kwargs) -> Serializer:
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.build_request_serializer(**kwargs)

        deserialized = self.build_serializer(**kwargs)
        deserialized.is_valid(raise_exception=True)
        return deserialized

    def build_response_serializer(self, instance: Any) -> Serializer:
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.build_response_serializer(instance)

        return self.build_serializer(instance=instance)

    def handle_request(
            self,
            request: Request,
            data: Mapping,
            func: Callable,
            *args,
            **kwargs
    ) -> Any:
        deserialized = self.build_request_serializer(data=data)
        return func(request, deserialized, *args, **kwargs)

    def handle_response(self, result: Any) -> Response:
        return Response(self.build_response_serializer(result).data)

    def typedef(self) -> typedefs.TypeDef:
        if isinstance(self.serializer, type):
            return typedefs.derive_type_from_class(self.serializer)
        return typedefs.derive_type_from_instance(self.serializer)

class BlobSerializer(SerializerWrapper):
    def __init__(self) -> None:
        super().__init__(None) # type: ignore

    def typedef(self) -> typedefs.BlobType:
        return typedefs.BlobType()

class PatchSerializerWrapper(SerializerWrapper):
    def __init__(self, serializer: Type[serializers.ModelSerializer]) -> None:
        super().__init__(serializer)

    def build_response_serializer(self, instance):
        raise Exception('Patch serializers cannot be used in response.')

    def handle_request(
            self,
            request: Request,
            data: Mapping[Any, Any],
            func: Callable,
            *args,
            **kwargs
    ) -> Model:
        id_serializer = build_id_serializer(self.serializer.Meta.model)(data={ # type: ignore
            'id': kwargs.pop('id', None),
        })
        id_serializer.is_valid(raise_exception=True)
        instance = id_serializer.validated_data['id']

        deserialized = self.build_request_serializer(instance=instance, data=data, partial=True)
        return func(request, deserialized, *args, **kwargs)

    def typedef(self) -> typedefs.PatchType:
        return typedefs.PatchType(super().typedef(), self.serializer.Meta.model) # type: ignore

class DelegatedSerializerWrapper(SerializerWrapper):
    def handle_request(
            self,
            request: Request,
            data: Any,
            func: Callable,
            *args,
            **kwargs
    ) -> Any:
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.handle_request(request, data, func, *args, **kwargs)
        return super().handle_request(request, data, func, *args, **kwargs)

    def handle_response(self, result: Any):
        if isinstance(self.serializer, SerializerWrapper):
            return self.serializer.handle_response(result)
        return super().handle_response(result)

class MultipartSerializerWrapper(DelegatedSerializerWrapper):
    def typedef(self) -> typedefs.FormDataType:
        return typedefs.FormDataType(super().typedef())

class ListSerializerWrapper(SerializerWrapper):
    def build_serializer(self, *args, **kwargs) -> Serializer:
        return super().build_serializer(*args, many=True, **kwargs)

    def typedef(self) -> typedefs.ArrayType:
        return typedefs.ArrayType(super().typedef())

def build_id_serializer(model) -> Type[serializers.Serializer]:
    class IdSerializer(serializers.Serializer):
        id = relations.PrimaryKeyRelatedField(queryset=model.objects.all(), allow_null=False)

        class Meta:
            js_response_type = 'Mappable'
    return IdSerializer

class ModelIdQuery(SerializerWrapper):
    def __init__(self, model: Type[ModelWithId]) -> None:
        super().__init__(build_id_serializer(model))

    def handle_request(
            self,
            request: Request,
            data: Mapping[Any, Any],
            func: Callable,
            *args,
            **kwargs
    ) -> Any:
        def callback(req, des, *args, **kwargs):
            return func(req, des.validated_data['id'], *args, **kwargs)

        return super().handle_request(request, {
            'id': kwargs.pop('id', None),
        }, callback, *args, **kwargs)
