import logging
from base64 import urlsafe_b64encode
from uuid import uuid4
from typing import List, Dict, Final, Any, Callable, Iterable, TypeVar, Optional, TYPE_CHECKING

from django.db import models
from rest_framework import status as http_status

T = TypeVar("T", bound="ValidatingModel", covariant=True)

LOGGER: Final[logging.Logger] = logging.getLogger(__name__)

def merge(dictA: Dict[Any, Any], dictB: Dict[Any, Any]) -> None:
    for (key, value) in dictB.items():
        if not key in dictA:
            dictA[key] = value

EXCEPTION_CODES: Final[List[str]] = [
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
    code: str
    status: int
    message_args: Dict[str, str]

    # pylint: disable=bad-whitespace
    def __init__(self, code: str, status: int=http_status.HTTP_400_BAD_REQUEST, **kwargs) -> None:
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

def uuid(start: str) -> str:
    return start + urlsafe_b64encode(uuid4().bytes).decode("utf-8")

def call_validators(validators: Iterable[Callable[[models.Model], None]], obj: models.Model):
    for validator in validators:
        validator(obj)

if TYPE_CHECKING:
    # pylint: disable=unsubscriptable-object
    BaseQuerySet = models.QuerySet[T]
else:
    BaseQuerySet = models.QuerySet

class ValidatingQuerySet(BaseQuerySet):
    def bulk_create(self, objs: Iterable[T], batch_size: Optional[int] = None,
                    ignore_conflicts: bool = False) -> List[T]:
        for obj in objs:
            call_validators(self.model.validators, obj)

        return super().bulk_create(objs, batch_size, ignore_conflicts)

class ValidatingModel(models.Model):
    validators: Iterable[Callable[[models.Model], None]]
    objects: models.Manager = ValidatingQuerySet.as_manager()

    def save(self, **kwargs):
        call_validators(self.validators, self)
        return super().save(**kwargs)

    class Meta:
        abstract = True
