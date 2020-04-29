import logging
from base64 import urlsafe_b64encode
from uuid import uuid4

from django.db import models
from rest_framework import status as http_status

LOGGER = logging.getLogger(__name__)

def merge(dictA, dictB):
    for (key, value) in dictB.items():
        if not key in dictA:
            dictA[key] = value

EXCEPTION_CODES = [
    'unknown-exception',
    'catalog-mismatch',
    'cyclic-structure',
    'invalid-tag',
    'unauthenticated',
    'validation-failure',
    'parse-failure',
    'api-failure',
    'server-error',
    'unknown-method',
    'catalog-change',
    'unknown-type',
    'signup-bad-email',
    'login-failed',
    'not-found',
    'not-allowed',
    'integrity-error',
    'invalid-name',
]

class ApiException(Exception):
    def __init__(self, code, status=http_status.HTTP_400_BAD_REQUEST, **kwargs):
        super().__init__()
        if code in EXCEPTION_CODES:
            self.code = code
            self.status = status
            self.message_args = {}
            for (key, value) in kwargs.items():
                self.message_args[key] = value
        else:
            self.code = 'unknown-exception'
            self.status = status
            self.message_args = {
                'code': code,
            }

    def __str__(self):
        return "Code: '%s', Status: %s, Arguments: %s" % (self.code, self.status, self.message_args)

def uuid(start):
    return start + urlsafe_b64encode(uuid4().bytes).decode("utf-8")

def validatingModel(*validators):
    def call_validators(obj):
        for validator in validators:
            validator(obj)

    class ValidatingQuerySet(models.QuerySet):
        def bulk_create(self, objs, **kwargs):
            for obj in objs:
                call_validators(obj)

            return super().bulk_create(objs, **kwargs)

    class ValidatingModel(models.Model):
        objects = ValidatingQuerySet.as_manager()

        def save(self, **kwargs):
            call_validators(self)
            return super().save(**kwargs)

        class Meta:
            abstract = True

    return ValidatingModel
