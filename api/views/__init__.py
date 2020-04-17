import logging
from pprint import pformat

from django.http.response import HttpResponseBase
from django.db.utils import IntegrityError
from rest_framework.decorators import api_view as rest_view, parser_classes
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.parsers import JSONParser, MultiPartParser

from ..utils import ApiException
from ..serializers.wrappers import SerializerWrapper, MultipartSerializerWrapper
from ..serializers import ApiExceptionSerializer

LOGGER = logging.getLogger(__name__)

class ApiView:
    def __init__(self, view, methods, request, response):
        self.view = view
        self.methods = methods
        self.request = request
        self.response = response

    def __call__(self, *args, **kwargs):
        return self.view(*args, **kwargs)

def api_view(http_method_names=None, requires_login=True, request=None, response=None):
    if http_method_names is None:
        http_method_names = ['GET', 'PUT', 'OPTIONS', 'POST', 'DELETE', 'PATCH']
    elif not isinstance(http_method_names, list):
        http_method_names = [http_method_names]
    rest_decorator = rest_view(http_method_names=http_method_names)

    def decorator(func):
        def inner_view(req, *args, **kwargs):
            # pylint: disable=broad-except
            try:
                if requires_login and (req.user is None or not req.user.is_authenticated):
                    raise ApiException('unauthenticated',
                                       status=status.HTTP_403_FORBIDDEN)

                try:
                    data = req.query_params if req.method == 'GET' else req.data

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

                except ApiException:
                    raise

                except IntegrityError as exception:
                    LOGGER.exception('Database integrity error.')
                    raise ApiException('integrity-error',
                                       status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                       detail=str(exception))

                except exceptions.ValidationError as exception:
                    LOGGER.exception('Validation failure.')
                    raise ApiException('validation-failure',
                                       status=exception.status_code,
                                       detail=pformat(exception.detail, indent=2))

                except exceptions.ParseError as exception:
                    LOGGER.exception('Parse failure.')
                    raise ApiException('parse-failure',
                                       status=exception.status_code,
                                       detail=pformat(exception.detail, indent=2))

                except exceptions.APIException as exception:
                    LOGGER.exception('Rest API failure.')
                    raise ApiException('api-failure',
                                       status=exception.status_code,
                                       detail=pformat(exception.detail, indent=2))

                except Exception as exception:
                    LOGGER.exception('General exception.')
                    raise ApiException('server-error',
                                       status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                       detail=str(exception))

            except ApiException as exception:
                serializer = ApiExceptionSerializer(exception)
                return Response(serializer.data, status=exception.status)

        decorated = inner_view
        pclasses = [JSONParser]
        if isinstance(request, MultipartSerializerWrapper):
            pclasses.append(MultiPartParser)
        decorated = parser_classes(pclasses)(decorated)
        decorated = rest_decorator(decorated)

        return ApiView(decorated, http_method_names, request, response)

    return decorator

@api_view()
def default(request):
    raise ApiException('unknown-method', status=status.HTTP_404_NOT_FOUND)
