import logging
from base64 import urlsafe_b64encode
from uuid import uuid4

from rest_framework.decorators import api_view as rest_view
from rest_framework import exceptions, status as http_status
from rest_framework.response import Response

LOGGER = logging.getLogger(__name__)

def build_error_response(code, message_args=None, detail=None,
                         status=http_status.HTTP_400_BAD_REQUEST):
    return Response({
        'code': code,
        'args': message_args,
        'detail': detail,
    }, status=status)

class ApiException(Exception):
    def __init__(self, code, message_args=None, detail=None,
                 status=http_status.HTTP_400_BAD_REQUEST):
        super().__init__()
        self.code = code
        self.message_args = message_args
        self.status = status
        self.detail = detail

def uuid(start):
    return start + urlsafe_b64encode(uuid4().bytes).decode("utf-8")

def api_view(http_method_names=None, requires_login=True):
    rest_decorator = rest_view(http_method_names=http_method_names)

    def decorator(func):
        def inner_view(request, *args, **kwargs):
            # pylint: disable=broad-except,too-many-return-statements
            if requires_login and request.user is None or not request.user.is_authenticated:
                return build_error_response('unauthenticated',
                                            status=http_status.HTTP_403_FORBIDDEN)

            try:
                return func(request, *args, **kwargs)
            except exceptions.ValidationError as exception:
                return build_error_response('validation-failure', detail=exception.detail,
                                            status=exception.status_code)
            except exceptions.ParseError as exception:
                return build_error_response('parse-failure', detail=exception.detail,
                                            status=exception.status_code)
            except exceptions.APIException as exception:
                LOGGER.error('APIException processing %s %s', request.method, request.path,
                             exc_info=True)
                return build_error_response('api-failure', detail=exception.detail,
                                            status=exception.status_code)
            except ApiException as exception:
                return build_error_response(exception.code, exception.message_args,
                                            exception.detail, exception.status)
            except Exception as exception:
                LOGGER.error('Exception processing %s %s', request.method, request.path,
                             exc_info=True)
                return build_error_response('server-error', detail=str(exception),
                                            status=http_status.HTTP_500_INTERNAL_SERVER_ERROR)

        return rest_decorator(inner_view)

    return decorator
