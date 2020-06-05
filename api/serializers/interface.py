from __future__ import annotations

from collections import OrderedDict
from typing import List, Dict, Type, Optional, TYPE_CHECKING

from django.db import models
from rest_framework.fields import Field

from ..utils import merge
from . import typedefs

if TYPE_CHECKING:
    from . import Serializer

class FieldFlags:
    required: bool
    readonly: bool
    writeonly: bool

    def __init__(self, required: bool, readonly: bool, writeonly: bool) -> None:
        if readonly and writeonly:
            raise Exception('Cannot have a readonly and writeonly field')
        self.required = required or readonly
        self.readonly = readonly
        self.writeonly = writeonly

def flags_from_field(field_instance: Field) -> FieldFlags:
    return FieldFlags(field_instance.required, field_instance.read_only, field_instance.write_only)

def flags_from_class(cls: Type[typedefs.SerializerMixin], field: str) -> FieldFlags:
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
    name: str
    typedef: typedefs.TypeDef

    def __init__(self, name: str, typedef: typedefs.TypeDef) -> None:
        self.name = name
        self.typedef = typedef

    def decoder(self) -> str:
        return self.typedef.nested_decoder()

class ResponseProperty(InterfaceProperty):
    def build_property(self) -> str:
        return 'readonly %s: %s' % (
            self.name,
            self.typedef.response_name(),
        )

class RequestProperty(InterfaceProperty):
    _required: bool

    def __init__(self, name: str, typedef: typedefs.TypeDef, required: bool) -> None:
        super().__init__(name, typedef)
        self._required = required

    @property
    def required(self) -> bool:
        return self._required

    def build_property(self) -> str:
        return '%s%s: %s' % (
            self.name,
            '?' if not self.required else '',
            self.typedef.request_name(),
        )

INTERFACE_MAP: Dict[str, InterfaceType] = dict()

class InterfaceType(typedefs.TypeDef):
    _request_properties: List[RequestProperty]
    _response_properties: List[ResponseProperty]
    for_request: bool
    for_response: bool
    _request_name: Optional[str]
    _response_name: Optional[str]
    cls: Type[typedefs.SerializerMixin]

    def __init__(self, cls: Type[typedefs.SerializerMixin]) -> None:
        super().__init__()

        self.cls = cls

        self._request_properties = []
        self._response_properties = []
        self.for_request = False
        self.for_response = False
        self._response_name = None
        self._request_name = None

    def add_request_property(self, prop: RequestProperty) -> None:
        self._request_properties.append(prop)

    def add_response_property(self, prop: ResponseProperty) -> None:
        self._response_properties.append(prop)

    def request_properties(self) -> List[RequestProperty]:
        return list(self._request_properties)

    def response_properties(self) -> List[ResponseProperty]:
        return list(self._response_properties)

    def response_interfaces(self) -> Dict[str, typedefs.ResponseInterface]:
        self.for_response = True

        ifaces: Dict[str, typedefs.ResponseInterface] = OrderedDict()
        for prop in self.response_properties():
            merge(ifaces, prop.typedef.response_interfaces())

        if self.response_name() not in ifaces:
            ifaces[self.response_name()] = self
        return ifaces

    def build_response_type(self) -> List[str]:
        result = map(lambda prop: '  %s;' % prop.build_property(), self.response_properties())
        return ['export interface %s {' % self.response_name()] + list(result) + ['}\n']

    def request_interfaces(self) -> Dict[str, typedefs.RequestInterface]:
        self.for_request = True

        ifaces: Dict[str, typedefs.RequestInterface] = OrderedDict()
        for prop in self.request_properties():
            merge(ifaces, prop.typedef.request_interfaces())

        if self.request_name() not in ifaces:
            ifaces[self.request_name()] = self
        return ifaces

    def build_request_type(self) -> List[str]:
        result = map(lambda prop: '  %s;' % prop.build_property(), self.request_properties())
        return ['export interface %s {' % self.request_name()] + list(result) + ['}\n']

    def response_name(self) -> str:
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

    def request_name(self) -> str:
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

    def response_decoder(self) -> List[str]:
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

    def nested_decoder(self) -> str:
        if not self.for_response:
            raise Exception('Should not be getting a decoder for %s '
                            'which is never used in responses.' % self.cls.__name__)

        return '%sDecoder' % self.response_name()

    @classmethod
    def build_typedef(cls, serializer: Type[typedefs.SerializerMixin]) -> InterfaceType:
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
            elif isinstance(field_instance, Field):
                flags = flags_from_field(field_instance)
            else:
                continue

            if not flags.writeonly:
                iface.add_response_property(ResponseProperty(key, typedef))

            if not flags.readonly:
                iface.add_request_property(RequestProperty(key, typedef, flags.required))

        return iface
