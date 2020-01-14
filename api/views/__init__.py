import logging

from django.http.response import HttpResponseBase
from rest_framework.decorators import api_view as rest_view, parser_classes
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser

from ..utils import ApiException, build_error_response
from ..serializers import SerializerWrapper, MultipartSerializerWrapper

LOGGER = logging.getLogger(__name__)

# pylint: disable=too-few-public-methods
class ApiView:
    def __init__(self, view, method, request, response):
        self.view = view
        self.method = method
        self.request = request
        self.response = response

    def __call__(self, *args, **kwargs):
        return self.view(*args, **kwargs)

def api_view(http_method_name=None, requires_login=True, request=None, response=None):
    if http_method_name is None:
        rest_decorator = rest_view(http_method_names=
                                   ['GET', 'PUT', 'OPTIONS', 'POST', 'DELETE', 'PATCH'])
    else:
        rest_decorator = rest_view(http_method_names=[http_method_name])

    def decorator(func):
        def inner_view(req, *args, **kwargs):
            # pylint: disable=broad-except,too-many-return-statements
            if requires_login and (req.user is None or not req.user.is_authenticated):
                return build_error_response('unauthenticated',
                                            status=status.HTTP_403_FORBIDDEN)

            try:
                data = req.data
                if http_method_name == 'GET':
                    data = req.query_params
                if isinstance(request, SerializerWrapper):
                    result = request.handle_request(req, data, func, *args, **kwargs)
                elif request is not None:
                    deserialized = request(data=data)
                    deserialized.is_valid(raise_exception=True)
                    result = func(req, deserialized, *args, **kwargs)
                else:
                    result = func(req, *args, **kwargs)

                if isinstance(result, HttpResponseBase):
                    return result
                if isinstance(response, SerializerWrapper):
                    return response.handle_response(result)
                if response is not None:
                    return Response(response(result).data)
                return Response(result)

            except exceptions.ValidationError as exception:
                return build_error_response('validation-failure', detail=exception.detail,
                                            status=exception.status_code)
            except exceptions.ParseError as exception:
                return build_error_response('parse-failure', detail=exception.detail,
                                            status=exception.status_code)
            except exceptions.APIException as exception:
                LOGGER.error('APIException processing %s %s', req.method, req.path,
                             exc_info=True)
                return build_error_response('api-failure', detail=exception.detail,
                                            status=exception.status_code)
            except ApiException as exception:
                return build_error_response(exception.code, exception.message_args,
                                            exception.detail, exception.status)
            except Exception as exception:
                LOGGER.error('Exception processing %s %s', req.method, req.path,
                             exc_info=True)
                return build_error_response('server-error', detail=str(exception),
                                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        decorated = inner_view
        if isinstance(request, MultipartSerializerWrapper):
            decorated = parser_classes([MultiPartParser])(decorated)
        decorated = rest_decorator(decorated)

        return ApiView(decorated, http_method_name, request, response)

    return decorator

@api_view()
def default(request):
    raise ApiException('unknown-method', status=status.HTTP_404_NOT_FOUND)
