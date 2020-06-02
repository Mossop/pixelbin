from collections import OrderedDict
from typing import Dict

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
    def __init__(self, name, typedef):
        self.name = name
        self.typedef = typedef

    def decoder(self):
        return self.typedef.nested_decoder()

class ResponseProperty(InterfaceProperty):
    def build_property(self):
        return 'readonly %s: %s' % (
            self.name,
            self.typedef.response_name(),
        )

class RequestProperty(InterfaceProperty):
    def __init__(self, name, typedef, required):
        super().__init__(name, typedef)
        self._required = required

    @property
    def required(self):
        return self._required

    def build_property(self):
        return '%s%s: %s' % (
            self.name,
            '?' if not self.required else '',
            self.typedef.request_name(),
        )

INTERFACE_MAP: Dict[str, "InterfaceType"] = dict()

class InterfaceType(typedefs.TypeDef):
    def __init__(self, cls):
        super().__init__()

        self.cls = cls

        self._request_properties = []
        self._response_properties = []
        self.for_request = False
        self.for_response = False
        self._response_name = None
        self._request_name = None

    def add_request_property(self, prop):
        self._request_properties.append(prop)

    def add_response_property(self, prop):
        self._response_properties.append(prop)

    def request_properties(self):
        return list(self._request_properties)

    def response_properties(self):
        return list(self._response_properties)

    def response_interfaces(self):
        self.for_response = True

        ifaces = OrderedDict()
        for prop in self.response_properties():
            merge(ifaces, prop.typedef.response_interfaces())

        if self.response_name() not in ifaces:
            ifaces[self.response_name()] = self
        return ifaces

    def build_response_type(self):
        result = map(lambda prop: '  %s;' % prop.build_property(), self.response_properties())
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
        result = map(lambda prop: '  %s;' % prop.build_property(), self.request_properties())
        return ['export interface %s {' % self.request_name()] + list(result) + ['}\n']

    def response_name(self):
        if not self.for_response:
            raise Exception('Trying to get response name for %s which is never used in responses.' %
                            self.cls.__name__)
        if self._response_name is not None:
            return self._response_name

        self._response_name = getattr(self.cls.Meta, 'js_response_type', None)
        if self._response_name is None and not self.for_request:
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
        if self._request_name is None and not self.for_response:
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

            if not flags.writeonly:
                iface.add_response_property(ResponseProperty(key, typedef))

            if not flags.readonly:
                iface.add_request_property(RequestProperty(key, typedef, flags.required))

        return iface
