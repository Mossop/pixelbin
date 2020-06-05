import json
import logging
from collections import OrderedDict

from rest_framework import serializers, fields, relations
from rest_framework.response import Response
from django.db import models
from django.core.exceptions import FieldDoesNotExist

from ..utils import merge, EXCEPTION_CODES
from . import typedefs

LOGGER = logging.getLogger(__name__)

class Serializer(serializers.Serializer, typedefs.SerializerMixin):
    def update(self, instance, validated_data):
        pass

    def create(self, validated_data):
        pass

class ListSerializer(serializers.ListSerializer, typedefs.SerializerMixin):
    def update(self, instance, validated_data):
        pass

    def create(self, validated_data):
        pass

    def instance_typedef(self) -> typedefs.TypeDef:
        return typedefs.ArrayType(typedefs.derive_type_from_instance(self.child))

class MapSerializer(ListSerializer):
    def instance_typedef(self) -> typedefs.TypeDef:
        return typedefs.MapType(typedefs.derive_type_from_instance(self.child))

class ModelSerializer(serializers.ModelSerializer, typedefs.SerializerMixin):
    @classmethod
    def serializable_fields(cls):
        properties = OrderedDict()
        names = getattr(cls.Meta, 'fields', [])

        model = getattr(cls.Meta, 'model', None)
        set_fields = getattr(cls, '_declared_fields', dict())
        for name in names:
            if name in set_fields:
                properties[name] = set_fields[name]
                continue
            try:
                properties[name] = model._meta.get_field(name)
            except FieldDoesNotExist:
                properties[name] = getattr(model, name)

        return properties.items()

    class Meta:
        pass

class ApiExceptionSerializer(Serializer):
    code = serializers.ChoiceField(choices=EXCEPTION_CODES, label='ApiErrorCode')
    args = serializers.DictField(child=serializers.CharField(), source='message_args')

    class Meta:
        js_response_type = 'ApiErrorData'
