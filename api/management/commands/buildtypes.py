from collections import OrderedDict

from django.core.management.base import BaseCommand

from base.utils import path
from ...urls import urlpatterns
from ...utils import merge
from ...views import ApiView
from ...serializers.typedefs import VoidType, NullType, BlobType, FormDataType
from ...serializers import ApiExceptionSerializer

header = """import { Orientation } from "media-metadata/lib/metadata";
import moment from "moment";
import { JsonDecoder } from "ts.data.json";

import { DateDecoder, OrientationDecoder, MapDecoder, EnumDecoder } from "../utils/decoders";
import { Mappable, MapOf } from "../utils/maps";
import { makeRequest, MethodList, RequestData, JsonRequestData, QueryRequestData,
  FormRequestData, JsonDecoderDecoder, BlobDecoder, RequestPk, Patch } from "./helpers";
import { Album, Catalog, Person, Tag, Media } from "./highlevel";
"""

def method_name(st):
    return ''.join(map(lambda s: s.capitalize(), st.replace('/', '_').split('_')))

class Command(BaseCommand):
    help = 'Generates the TypeScript types for the API.'

    def __init__(self):
        super().__init__()
        self.fp = None

    def write(self, st):
        self.fp.write('%s\n' % st)

    def write_response_interfaces(self, ifaces):
        for iface in ifaces.values():
            if iface.response_name() == 'Mappable':
                continue

            self.write('\n'.join(iface.build_response_type()))

            decoder = iface.decoder()
            if decoder is not None:
                self.write('\n'.join(decoder))
                self.write('')

    def write_request_interfaces(self, ifaces):
        for iface in ifaces.values():
            if iface.request_name() == 'Mappable':
                continue

            self.write('\n'.join(iface.build_request_type()))

    def write_method_enum(self, methods):
        self.write('export enum ApiMethod {')
        for (method, (_, url, _, _)) in methods.items():
            self.write('  %s = "%s",' % (method, url))
        self.write('}')

    def write_method_map(self, methods):
        self.write('export const HttpMethods: MethodList = {')
        for (method, (method_types, _, _, _)) in methods.items():
            self.write('  [ApiMethod.%s]: "%s",' % (method, method_types[0]))
        self.write('};')

    def write_request_overloads(self, methods):
        for (method, (_, _, request, response)) in methods.items():
            if isinstance(request, NullType):
                data_param = ''
            else:
                data_param = ', data: %s' % request.request_name()
            self.write('export function request(method: ApiMethod.%s%s): Promise<%s>;' % \
                       (method, data_param, response.response_name()))

    def write_request_method(self, methods):
        self.write('// eslint-disable-next-line @typescript-eslint/no-explicit-any')
        self.write('export function request(path: ApiMethod, data?: any): '
                   'Promise<object | void> {')
        self.write('  let request: RequestData<object | void>;\n')
        self.write('  switch (path) {')

        for (method, (method_types, _, request, response)) in methods.items():
            if isinstance(response, VoidType):
                decoder = 'VoidDecoder'
            elif isinstance(response, BlobType):
                decoder = 'BlobDecoder'
            else:
                decoder = 'JsonDecoderDecoder(%s)' % response.nested_decoder()

            if method_types[0] == 'GET':
                request_type = 'QueryRequestData(data, '
            elif isinstance(request, NullType):
                request_type = 'RequestData('
            elif isinstance(request, FormDataType):
                request_type = 'FormRequestData(data, '
            else:
                request_type = 'JsonRequestData(data, '

            self.write('    case ApiMethod.%s:' % method)
            self.write('      request = new %s%s);' % (request_type, decoder))
            self.write('      break;')

        self.write('  }\n')

        self.write('  return makeRequest(path, request);')
        self.write('}')

    def handle(self, *args, **options):
        request_ifaces = OrderedDict()
        response_ifaces = OrderedDict()
        methods = dict()

        merge(response_ifaces, ApiExceptionSerializer.typedef().response_interfaces())

        self.fp = open(path('app', 'js', 'api', 'types.ts'), 'w')
        self.write(header)

        for url in urlpatterns:
            if len(str(url.pattern)) > 0 and isinstance(url.callback, ApiView):
                response = url.callback.response
                request = url.callback.request
                method = method_name(str(url.pattern))

                if request is not None:
                    merge(request_ifaces, request.typedef().request_interfaces())
                    request = request.typedef()
                else:
                    request = NullType()

                if response is not None:
                    merge(response_ifaces, response.typedef().response_interfaces())
                    response = response.typedef()
                else:
                    response = VoidType()

                methods[method] = (url.callback.methods, str(url.pattern), request, response)

        for key in response_ifaces:
            request_ifaces.pop(key, None)

        self.write_response_interfaces(response_ifaces)
        self.write_request_interfaces(request_ifaces)
        self.write_method_enum(methods)
        self.write('')
        self.write_method_map(methods)
        self.write('')
        self.write_request_overloads(methods)
        self.write('')
        self.write_request_method(methods)
