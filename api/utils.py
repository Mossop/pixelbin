import logging
from base64 import urlsafe_b64encode
from uuid import uuid4

from rest_framework import status as http_status
from rest_framework.response import Response

LOGGER = logging.getLogger(__name__)

def merge(dictA, dictB):
    for (key, value) in dictB.items():
        if not key in dictA:
            dictA[key] = value

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
