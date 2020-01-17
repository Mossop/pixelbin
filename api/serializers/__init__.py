import json
import logging
from collections import OrderedDict

from rest_framework import serializers, fields, relations
from rest_framework.response import Response
from django.db import models
from django.core.exceptions import FieldDoesNotExist

from ..utils import merge, EXCEPTION_CODES
from ..metadata import OrientationField

LOGGER = logging.getLogger(__name__)

# pylint: disable=too-few-public-methods
class FieldFlags:
    def __init__(self, required, readonly, writeonly):
        if readonly and writeonly:
            raise Exception('Cannot have a readonly and writeonly field')
        self.required = required or readonly
        self.readonly = readonly
        self.writeonly = writeonly

def flags_from_field(field_instance):
    return FieldFlags(field_instance.required, field_instance.read_only, field_instance.write_only)

def flags_from_class(cls, field):
    kwargs = getattr(cls.Meta, 'extra_kwargs', None)
    if kwargs is not None and field in kwargs:
        flags = kwargs[field]
    else:
        flags = {}
    return FieldFlags(
        flags.get('required', True),
        flags.get('read_only', False),
        flags.get('write_only', False),
    )

INTERFACE_MAP = dict()

class TypeDef:
    def __init__(self):
        pass

    @property
    def symmetrical(self):
        return True

    def request_interfaces(self):
        return OrderedDict()

    def response_interfaces(self):
        return OrderedDict()

    def request_name(self):
        raise Exception('%s does not define a request type.' % repr(type(self)))

    def response_name(self):
        raise Exception('%s does not define a request type.' % repr(type(self)))

    def decoder(self):
        raise Exception('%s does not define a decoder.' % repr(type(self)))

    def nested_decoder(self):
        return self.decoder()

class NamedType(TypeDef):
    def __init__(self, name):
        super().__init__()
        self.name = name

    def request_name(self):
        return self.name

    def response_name(self):
        return self.name

class DecodableNamedType(NamedType):
    def __init__(self, name, decoder):
        super().__init__(name)
        self._decoder = decoder

    def decoder(self):
        return self._decoder

class ConstantType(DecodableNamedType):
    def __init__(self, name):
        super().__init__(name, 'JsonDecoder.isExactly(%s)' % name)

class PrimitiveType(DecodableNamedType):
    def __init__(self, name):
        super().__init__(name, 'JsonDecoder.%s' % name)

class NullType(DecodableNamedType):
    def __init__(self):
        super().__init__('null', 'JsonDecoder.isNull(null)')

class BlobType(DecodableNamedType):
    def __init__(self):
        super().__init__('Blob', None)

class VoidType(NamedType):
    def __init__(self):
        super().__init__('void')

class DateType(DecodableNamedType):
    def __init__(self):
        super().__init__('moment.Moment', 'DateDecoder')

class OrientationType(DecodableNamedType):
    def __init__(self):
        super().__init__('Orientation', 'OrientationDecoder')

def build_enum_name(value):
    return ''.join(map(lambda t: t[0].upper() + t[1:], value.split('-')))

class EnumType(TypeDef):
    def __init__(self, name, choices):
        super().__init__()
        self.name = name
        self.choices = choices

    def request_interfaces(self):
        result = OrderedDict()
        result[self.name] = self
        return result

    def build_request_type(self):
        result = map(lambda v: '  %s = "%s",' % (build_enum_name(v), v), self.choices)
        return ['export enum %s {' % self.name] + list(result) + ['}\n']

    def response_interfaces(self):
        return self.request_interfaces()

    def build_response_type(self):
        return self.build_request_type()

    def request_name(self):
        return self.name

    def response_name(self):
        return self.name

    def decoder(self):
        return None

    def nested_decoder(self):
        return 'EnumDecoder(JsonDecoder.string, "%s")' % self.name

class InterfaceProperty:
    def __init__(self, name, typedef, flags):
        self.name = name
        self.typedef = typedef
        self.flags = flags

    @property
    def symmetrical(self):
        if self.readonly or self.writeonly:
            return False
        return self.typedef.symmetrical

    @property
    def writeonly(self):
        return self.flags.writeonly

    @property
    def readonly(self):
        return self.flags.readonly

    @property
    def required(self):
        return self.flags.required

    def build_property(self, type_name):
        return '%s%s: %s' % (
            self.name,
            '?' if not self.required else '',
            type_name,
        )

    def request_property(self):
        return self.build_property(self.typedef.request_name())

    def response_property(self):
        return self.build_property(self.typedef.response_name())

    def decoder(self):
        return self.typedef.nested_decoder()

class InterfaceType(TypeDef):
    def __init__(self, cls):
        super().__init__()

        self.cls = cls

        self.properties = []
        self._symmetrical = True
        self.for_request = False
        self.for_response = False
        self._response_name = None
        self._request_name = None

    def add_property(self, prop):
        if not prop.symmetrical:
            self._symmetrical = False
        self.properties.append(prop)

    @property
    def symmetrical(self):
        return self._symmetrical

    def request_properties(self):
        return filter(lambda p: not p.readonly, self.properties)

    def response_properties(self):
        return filter(lambda p: not p.writeonly, self.properties)

    def response_interfaces(self):
        self.for_response = True

        ifaces = OrderedDict()
        for prop in self.response_properties():
            merge(ifaces, prop.typedef.response_interfaces())

        if self.response_name() not in ifaces:
            ifaces[self.response_name()] = self
        return ifaces

    def build_response_type(self):
        result = map(lambda prop: '  %s;' % prop.response_property(), self.response_properties())
        return ['export interface %s {' % self.response_name()] + list(result) + ['}\n']

    def request_interfaces(self):
        self.for_request = True

        ifaces = OrderedDict()
        for prop in self.request_properties():
            merge(ifaces, prop.typedef.request_interfaces())

        if self.request_name() not in ifaces:
            ifaces[self.request_name()] = self
        return ifaces

    def build_request_type(self):
        result = map(lambda prop: '  %s;' % prop.request_property(), self.request_properties())
        return ['export interface %s {' % self.request_name()] + list(result) + ['}\n']

    def response_name(self):
        if not self.for_response:
            raise Exception('Trying to get response name for %s which is never used in responses.' %
                            self.cls.__name__)
        if self._response_name is not None:
            return self._response_name

        self._response_name = getattr(self.cls.Meta, 'js_response_type', None)
        if self._response_name is None and (self.symmetrical or not self.for_request):
            self._response_name = getattr(self.cls.Meta, 'js_request_type', None)

        if self._response_name is None:
            raise Exception('No js_response_type found for %s.' % self.cls.__name__)
        return self._response_name

    def request_name(self):
        if not self.for_request:
            raise Exception('Trying to get response name for %s which is never used in responses.' %
                            self.cls.__name__)

        if self._request_name is not None:
            return self._request_name

        self._request_name = getattr(self.cls.Meta, 'js_request_type', None)
        if self._request_name is None and (self.symmetrical or not self.for_response):
            self._request_name = getattr(self.cls.Meta, 'js_response_type', None)

        if self._request_name is None:
            raise Exception('No js_request_type found for %s.' % self.cls.__name__)
        return self._request_name

    def decoder(self):
        if not self.for_response:
            raise Exception('Should not be getting a decoder for %s '
                            'which is never used in responses.' % self.cls.__name__)

        decoder = [
            'export const %sDecoder = JsonDecoder.object<%s>(' %
            (self.response_name(), self.response_name()),
            '  {',
        ]

        for prop in self.response_properties():
            decoder.append('    %s: %s,' % (prop.name, prop.decoder()))

        decoder.extend([
            '  },',
            '  "%s"' % self.response_name(),
            ');'
        ])
        return decoder

    def nested_decoder(self):
        if not self.for_response:
            raise Exception('Should not be getting a decoder for %s '
                            'which is never used in responses.' % self.cls.__name__)

        return '%sDecoder' % self.response_name()

class UnionType(TypeDef):
    def __init__(self, typedefs):
        super().__init__()
        self.typedefs = list(typedefs)
        if len(self.typedefs) == 0:
            raise Exception('Union types must have at least one typedef.')

    @property
    def symmetrical(self):
        for typedef in self.typedefs:
            if not typedef.symmetrical:
                return False
        return True

    def make_name(self, types):
        return ' | '.join(types)

    def response_name(self):
        return self.make_name(map(lambda t: t.response_name(), self.typedefs))

    def request_name(self):
        return self.make_name(map(lambda t: t.request_name(), self.typedefs))

    def request_interfaces(self):
        ifaces = OrderedDict()
        for typedef in self.typedefs:
            merge(ifaces, typedef.request_interfaces())
        return ifaces

    def response_interfaces(self):
        ifaces = OrderedDict()
        for typedef in self.typedefs:
            merge(ifaces, typedef.response_interfaces())
        return ifaces

    def decoder(self):
        return 'JsonDecoder.oneOf([%s], "%s")' % \
               (', '.join(map(lambda t: t.nested_decoder(), self.typedefs)), self.response_name())

class WrappedTypeDef(TypeDef):
    def __init__(self, typedef):
        super().__init__()
        self.typedef = typedef

    @property
    def symmetrical(self):
        return self.typedef.symmetrical

    def make_name(self, name):
        return name

    def response_name(self):
        return self.make_name(self.typedef.response_name())

    def request_name(self):
        return self.make_name(self.typedef.request_name())

    def request_interfaces(self):
        return self.typedef.request_interfaces()

    def response_interfaces(self):
        return self.typedef.response_interfaces()

    def decoder(self):
        return self.typedef.decoder()

class ArrayType(WrappedTypeDef):
    def make_name(self, name):
        if ' ' in name:
            return '(%s)[]' % name
        return '%s[]' % name

    def decoder(self):
        return 'JsonDecoder.array(%s, "%s[]")' % \
               (self.typedef.nested_decoder(), self.typedef.response_name())

class MapType(WrappedTypeDef):
    def make_name(self, name):
        return 'MapOf<%s>' % name

    def decoder(self):
        return 'MapDecoder(%s, "%s")' % (self.typedef.nested_decoder(), self.response_name())

class DictType(WrappedTypeDef):
    def make_name(self, name):
        return 'Record<string, %s>' % name

    def decoder(self):
        return 'JsonDecoder.dictionary(%s, "%s")' % \
               (self.typedef.nested_decoder(), self.response_name())

class PatchType(WrappedTypeDef):
    def request_name(self):
        return 'Patch<%s>' % self.typedef.request_name()

    def response_name(self):
        raise Exception('Should never serialize a patch type.')

class FormDataType(WrappedTypeDef):
    pass

# pylint: disable=too-many-return-statements
def derive_type_from_class(field_class):
    if not isinstance(field_class, type):
        raise Exception('Attempt to derive a type from an instance when expected a class.')

    if issubclass(field_class, FieldMixin) or issubclass(field_class, SerializerMixin):
        return field_class.typedef()

    if issubclass(field_class, OrientationField):
        return OrientationType()

    if issubclass(field_class, fields.FileField):
        return PrimitiveType('Blob')

    if issubclass(field_class, fields.IntegerField):
        return PrimitiveType('number')

    if issubclass(field_class, fields.FloatField):
        return PrimitiveType('number')

    if issubclass(field_class, fields.BooleanField):
        return PrimitiveType('boolean')

    if issubclass(field_class, fields.CharField):
        return PrimitiveType('string')

    if issubclass(field_class, fields.ChoiceField):
        return PrimitiveType('string')

    if issubclass(field_class, fields.DateTimeField):
        return DateType()

    if issubclass(field_class, fields.SerializerMethodField):
        return PrimitiveType('never')

    if issubclass(field_class, relations.PrimaryKeyRelatedField):
        return PrimitiveType('string')

    raise Exception('Could not derive JS type for "%s".' % repr(field_class))

# pylint: disable=too-many-branches
def derive_type_from_instance(field_instance):
    if isinstance(field_instance, type):
        raise Exception('Attempt to derive a type from a class when expected an instance.')

    if isinstance(field_instance, SerializerWrapper):
        typedef = field_instance.typedef()

    elif isinstance(field_instance, models.fields.Field):
        if isinstance(field_instance, models.fields.related.ForeignKey):
            field_class = relations.PrimaryKeyRelatedField
        else:
            field_class = serializers.ModelSerializer.serializer_field_mapping[type(field_instance)]
        typedef = derive_type_from_class(field_class)
        if field_instance.null:
            typedef = UnionType([typedef, NullType()])

    elif isinstance(field_instance, fields.Field):
        if isinstance(field_instance, MapSerializer):
            typedef = MapType(derive_type_from_instance(field_instance.child))
        elif isinstance(field_instance, ListSerializer):
            typedef = ArrayType(derive_type_from_instance(field_instance.child))
        elif isinstance(field_instance, fields.ListField):
            typedef = ArrayType(derive_type_from_instance(field_instance.child))
        elif isinstance(field_instance, fields.DictField):
            typedef = DictType(derive_type_from_instance(field_instance.child))
        elif isinstance(field_instance, fields.ChoiceField):
            typedef = EnumType(field_instance.label, field_instance.choices)
        else:
            typedef = derive_type_from_class(type(field_instance))

        if field_instance.allow_null:
            typedef = UnionType([typedef, NullType()])

    else:
        for primitive in [str, float, int, bool]:
            if isinstance(field_instance, primitive):
                return ConstantType(json.dumps(field_instance))
        raise Exception('Could not derive JS type for "%s".' % repr(field_instance))

    return typedef

class FieldMixin:
    @classmethod
    def typedef(cls):
        return NullType()

class SerializerMixin:
    @classmethod
    def typedef(cls):
        if cls.__name__ in INTERFACE_MAP:
            return INTERFACE_MAP[cls.__name__]
        iface = InterfaceType(cls)
        INTERFACE_MAP[cls.__name__] = iface

        for (key, field_instance) in cls.serializable_fields():
            typedef = derive_type_from_instance(field_instance)
            if isinstance(field_instance, models.fields.Field):
                flags = flags_from_class(cls, key)
            elif isinstance(typedef, ConstantType):
                flags = FieldFlags(True, False, False)
            else:
                flags = flags_from_field(field_instance)

            if not flags.required and not flags.readonly and not flags.writeonly:
                # We're following the assumption that when sending data from the
                # database it will always be serialized so add two properties,
                # one required readonly property and one optional writeonly property.
                iface.add_property(InterfaceProperty(key, typedef, FieldFlags(True, True, False)))
                iface.add_property(InterfaceProperty(key, typedef, FieldFlags(False, False, True)))
            else:
                iface.add_property(InterfaceProperty(key, typedef, flags))

        return iface

    @classmethod
    def serializable_fields(cls):
        return cls._declared_fields.items()

class Serializer(serializers.Serializer, SerializerMixin):
    def update(self, instance, validated_data):
        pass

    def create(self, validated_data):
        pass

class ListSerializer(serializers.ListSerializer):
    def update(self, instance, validated_data):
        pass

    def create(self, validated_data):
        pass

class MapSerializer(ListSerializer):
    pass

class ModelSerializer(serializers.ModelSerializer, SerializerMixin):
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
            return derive_type_from_class(self.serializer)
        return derive_type_from_instance(self.serializer)

class BlobSerializer(SerializerWrapper):
    def __init__(self):
        super().__init__(None)

    def typedef(self):
        return BlobType()

class PatchSerializerWrapper(SerializerWrapper):
    def __init__(self, serializer):
        if not issubclass(serializer, ModelSerializer):
            raise Exception('Can only create a patch serializer for a model serializer.')
        super().__init__(serializer)

    def build_request_serializer(self, *args, data=None, **kwargs):
        id_serializer = build_id_serializer(self.serializer.Meta.model)(data=data)
        id_serializer.is_valid(raise_exception=True)
        instance = id_serializer.validated_data['id']
        del data['id']

        return super().build_request_serializer(instance, *args, data=data, partial=True, **kwargs)

    def build_response_serializer(self, *args, data=None, **kwargs):
        raise Exception('Patch serializers cannot be used in response.')

    def typedef(self):
        return PatchType(super().typedef())

class MultipartSerializerWrapper(SerializerWrapper):
    def typedef(self):
        return FormDataType(super().typedef())

class ListSerializerWrapper(SerializerWrapper):
    def build_serializer(self, *args, **kwargs):
        return super().build_serializer(*args, many=True, **kwargs)

    def typedef(self):
        return ArrayType(super().typedef())

def build_id_serializer(model):
    class IdSerializer(Serializer):
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

        super().handle_request(request, data, callback, *args, **kwargs)
