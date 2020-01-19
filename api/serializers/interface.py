from collections import OrderedDict

from django.db import models

from ..utils import merge
from . import typedefs

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

INTERFACE_MAP = dict()

class InterfaceType(typedefs.TypeDef):
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

    @classmethod
    def build_typedef(cls, serializer):
        if serializer.__name__ in INTERFACE_MAP:
            return INTERFACE_MAP[serializer.__name__]
        iface = cls(serializer)
        INTERFACE_MAP[serializer.__name__] = iface

        for (key, field_instance) in serializer.serializable_fields():
            typedef = typedefs.derive_type_from_instance(field_instance)
            if isinstance(field_instance, models.fields.Field):
                flags = flags_from_class(serializer, key)
            elif isinstance(typedef, typedefs.ConstantType):
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
