from django.test import TestCase, Client

from ..models import User, Catalog
from ..utils import uuid, ApiException
from ..storage.models import Server

def check_response(response):
    if response.status_code >= 400:
        info = response.json()
        if 'code' not in info or 'args' not in info:
            raise ApiException('server-error', response.status_code)
        raise ApiException(info['code'], response.status_code, **info['args'])

    return response

class ApiClient(Client):
    def get(self, *args, **kwargs):
        return check_response(super().get(*args, **kwargs))

    def post(self, *args, **kwargs):
        return check_response(super().post(*args, **kwargs))

    def patch(self, *args, **kwargs):
        return check_response(super().patch(*args, **kwargs))

    def put(self, *args, **kwargs):
        return check_response(super().put(*args, **kwargs))

    def delete(self, *args, **kwargs):
        return check_response(super().delete(*args, **kwargs))

class ApiExceptionContext:
    def __init__(self, code, failureException):
        self._code = code
        self._failureException = failureException
        self.exception = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_value is None:
            raise self._failureException("ApiException not raised")

        if not isinstance(exc_value, ApiException):
            return False

        if exc_value.code != self._code:
            raise self._failureException("Expected ApiException code '%s' but saw code '%s'." %
                                         (self._code, exc_value.code))

        self.exception = exc_value

        return True

class ApiTestCase(TestCase):
    client_class = ApiClient

    def create_user(self):
        return User.objects.create_user(email='dtownsend@oxymoronical.com',
                                        full_name='Dave Townsend',
                                        password='foobar')

    def add_catalog(self, name, user=None):
        storage = Server()
        storage.save()
        catalog = Catalog.objects.create(name=name, storage=storage)

        if user is not None:
            catalog.users.add(user)

        return catalog

    def assertRaisesApiException(self, code):
        return ApiExceptionContext(code, self.failureException)
