from __future__ import annotations

from typing import Protocol, runtime_checkable

from django.db import models

class ModelWithId(models.Model):
    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)

    class Meta:
        abstract = True

@runtime_checkable
class NamedItem(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def name(self) -> str: ...
