import json
from collections import OrderedDict

from rest_framework import serializers, fields, relations
from django.db import models

from . import wrappers
from ..utils import merge
from ..metadata import OrientationField

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

class RefType(DecodableNamedType):
    def __init__(self, name):
        super().__init__(name, 'JsonDecoder.string')

    @property
    def symmetrical(self):
        return False

    def request_name(self):
        return 'RequestPk<%s>' % self.name

    def response_name(self):
        return 'string'

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

    def nested_decoder(self):
        return self.decoder()

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
    def __init__(self, typedef, model):
        super().__init__(typedef)
        self.model = model

    def request_name(self):
        return 'Patch<%s, %s>' % (self.typedef.request_name(), self.model.__name__)

    def response_name(self):
        raise Exception('Should never serialize a patch type.')

class FormDataType(WrappedTypeDef):
    pass

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

    raise Exception('Could not derive JS type for "%s".' % repr(field_class))

def derive_type_from_instance(field_instance):
    if isinstance(field_instance, type):
        raise Exception('Attempt to derive a type from a class when expected an instance.')

    if isinstance(field_instance, wrappers.SerializerWrapper):
        typedef = field_instance.typedef()

    elif isinstance(field_instance, models.fields.Field):
        if isinstance(field_instance, models.fields.related.ForeignKey):
            typedef = RefType(field_instance.related_model.__name__)
        elif isinstance(field_instance, models.fields.related.ManyToManyField):
            typedef = ArrayType(RefType(field_instance.related_model.__name__))
        else:
            field_class = serializers.ModelSerializer.serializer_field_mapping[type(field_instance)]
            typedef = derive_type_from_class(field_class)
        if field_instance.null:
            typedef = UnionType([typedef, NullType()])

    elif isinstance(field_instance, fields.Field):
        if isinstance(field_instance, SerializerMixin):
            typedef = field_instance.instance_typedef()
        elif isinstance(field_instance, fields.ListField):
            typedef = ArrayType(derive_type_from_instance(field_instance.child))
        elif isinstance(field_instance, fields.DictField):
            typedef = DictType(derive_type_from_instance(field_instance.child))
        elif isinstance(field_instance, fields.ChoiceField):
            typedef = EnumType(field_instance.label, field_instance.choices)
        elif isinstance(field_instance, relations.PrimaryKeyRelatedField):
            return RefType(field_instance.get_queryset().model.__name__)
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
    def instance_typedef(self):
        return self.typedef()

    @classmethod
    def typedef(cls):
        # pylint: disable=import-outside-toplevel
        from .interface import InterfaceType
        return InterfaceType.build_typedef(cls)

    @classmethod
    def serializable_fields(cls):
        return cls._declared_fields.items()
