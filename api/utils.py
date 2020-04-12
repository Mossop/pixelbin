import logging
from base64 import urlsafe_b64encode
from uuid import uuid4

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

def uuid(start):
    return start + urlsafe_b64encode(uuid4().bytes).decode("utf-8")
