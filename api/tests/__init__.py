from random import Random
from contextlib import contextmanager

from django.test import TestCase, Client
from django.test.client import JSON_CONTENT_TYPE_RE
from django.contrib.auth import get_user
from django.http import HttpRequest
from faker import Faker
from PIL.Image import Image

from base.config import CONFIG

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

def get_authed_user(client):
    session = client.session
    if session is None:
        return None

    request = HttpRequest()
    request.session = session
    user = get_user(request)
    if not user.is_authenticated:
        return None
    return user

class ApiClient(Client):
    def get(self, path, data=None, secure=False, **kwargs):
        return check_response(super().get(path, data, secure, **kwargs))

    def post(self, path, data=None, content_type='application/json', secure=False, **kwargs):
        return check_response(super().post(path, data, content_type, secure, **kwargs))

    def patch(self, path, data=None, content_type='application/json', secure=False, **kwargs):
        if not JSON_CONTENT_TYPE_RE.match(content_type):
            data = self._encode_data(data, content_type)
        return check_response(super().patch(path, data, content_type, secure, **kwargs))

    def put(self, path, data=None, content_type='application/json', secure=False, **kwargs):
        if not JSON_CONTENT_TYPE_RE.match(content_type):
            data = self._encode_data(data, content_type)
        return check_response(super().put(path, data, content_type, secure, **kwargs))

    def delete(self, path, data=None, content_type='application/json', secure=False, **kwargs):
        if not JSON_CONTENT_TYPE_RE.match(content_type):
            data = self._encode_data(data, content_type)
        return check_response(super().delete(path, data, content_type, secure, **kwargs))

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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fake = Faker()
        self.fake.seed_instance(4723)

    def random_bool(self):
        return self.fake.random_element((True, False))

    def amend_case(self, st):
        newst = ''.join(map(lambda ch: ch.lower() if self.random_bool() else ch.upper(), st))
        if newst == st:
            return self.amend_case(st)
        return newst

    def random_thing(self):
        return ' '.join(self.fake.words(nb=2))

    def create_user(self):
        return User.objects.create_user(email=self.fake.email(),
                                        full_name=self.fake.name(),
                                        password=self.fake.password())

    def add_catalog(self, name=None, user=None):
        if name is None:
            name = self.random_thing()

        storage = Server()
        storage.save()
        catalog = Catalog.objects.create(name=name, storage=storage)

        if user is not None:
            catalog.users.add(user)

        return catalog

    def assertRaisesApiException(self, code):
        return ApiExceptionContext(code, self.failureException)

    def assertDictContains(self, found, expected):
        self.assertIsInstance(found, dict)
        self.assertIsInstance(expected, dict)

        keys = set(found.keys()) & set(expected.keys())
        copied = {
            k: found[k] for k in keys
        }
        self.assertEqual(copied, expected)

    def assertThumbnailSizeCorrect(self, thumb, target, width, height):
        self.assertIsInstance(thumb, Image)

        if width == height:
            self.assertEqual(thumb.width, target)
            self.assertEqual(thumb.height, target)
        elif width > height:
            self.assertEqual(thumb.width, target)
            self.assertAlmostEqual(thumb.height, target * height / width, delta=1)
        else:
            self.assertAlmostEqual(thumb.width, target * width / height, delta=1)
            self.assertEqual(thumb.height, target)

@contextmanager
def config_change(**kwargs):
    previous = []
    for config in kwargs:
        [section, option] = config.split('_', 1)
        has_option = CONFIG.has_option(section, option)
        if has_option:
            old_value = CONFIG.get(section, option)
        else:
            old_value = None
        previous.append([section, option, has_option, old_value])

        CONFIG.set(section, option, kwargs[config])

    try:
        yield
    finally:
        for [section, option, has_option, old_value] in previous:
            if has_option:
                CONFIG.set(section, option, old_value)
            else:
                try:
                    CONFIG.remove_option(section, option)
                except: # pylint: disable=bare-except
                    pass
