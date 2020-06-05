from __future__ import annotations

from typing import List, Optional, TYPE_CHECKING, Protocol, runtime_checkable, ContextManager

from django.db import models
from django.db.models import F, QuerySet
from django.db.models.functions import Coalesce, Lower
from django.db.models.expressions import RawSQL
from django_cte import CTEManager, With
from rest_framework import status

from .base import NamedItem, ModelWithId
from ..locks import lock
from ..storage.models import Storage
from ..storage.base import BaseFileStore
from ..utils import uuid, ApiException, ValidatingModel
from ..constraints import UniqueWithExpressionsConstraint

@runtime_checkable
class CatalogItem(Protocol):
    @property
    def id(self) -> str: ...

    @property
    def catalog(self) -> Catalog: ...

@runtime_checkable
class HierarchicalItem(CatalogItem, Protocol):
    @property
    def parent(self) -> HierarchicalItem: ...

def catalog_validator(obj: models.Model) -> None:
    if not isinstance(obj, HierarchicalItem):
        raise ApiException('api-failure')

    related_obj = obj.parent

    if related_obj is None:
        return

    if related_obj.catalog != obj.catalog:
        raise ApiException('catalog-mismatch')

def parent_validator(obj: models.Model) -> None:
    if not isinstance(obj, HierarchicalItem):
        raise ApiException('api-failure')

    parent = obj.parent
    while parent is not None:
        if parent.id == obj.id:
            raise ApiException('cyclic-structure')
        parent = parent.parent

def name_validator(obj: models.Model) -> None:
    if not isinstance(obj, NamedItem) or not isinstance(obj, CatalogItem):
        raise ApiException('api-failure')

    filters = {
        'catalog': obj.catalog,
        'name__iexact': obj.name,
    }

    if isinstance(obj, HierarchicalItem):
        filters['parent'] = obj.parent

    siblings = obj.__class__.objects.exclude(id=obj.id).filter(**filters)

    if siblings.exists():
        raise ApiException('invalid-name')

class Catalog(ModelWithId):
    name = models.CharField(max_length=100, blank=False)
    storage = models.ForeignKey(Storage, null=False,
                                on_delete=models.CASCADE, related_name='catalogs')

    def __init__(self, *args, **kwargs) -> None:
        if 'id' not in kwargs:
            kwargs['id'] = uuid('C')

        super().__init__(*args, **kwargs)

    @property
    def file_store(self) -> BaseFileStore:
        return self.storage.file_store

if TYPE_CHECKING:
    # pylint: disable=unsubscriptable-object,used-before-assignment
    AlbumQuerySet = QuerySet[Album]
else:
    AlbumQuerySet = QuerySet

class Album(ModelWithId, ValidatingModel):
    validators = [
        catalog_validator,
        parent_validator,
        name_validator,
    ]

    descendants_manager = CTEManager()

    stub = models.CharField(max_length=50, unique=True, default=None, blank=False, null=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='albums')
    name = models.CharField(max_length=100, blank=False)
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='albums',
                               null=True)

    def __init__(self, *args, **kwargs) -> None:
        if 'id' not in kwargs:
            kwargs['id'] = uuid('A')

        super().__init__(*args, **kwargs)

    def descendants(self) -> AlbumQuerySet:
        def make_albums_cte(cte):
            return (
                Album.descendants_manager.filter(id=self.id).values('id') \
                    .union(cte.join(Album, parent=cte.col.id).values('id'), all=True)
            )

        cte = With.recursive(make_albums_cte)

        return (
            cte.join(Album, id=cte.col.id).with_cte(cte)
        )

    class Meta:
        constraints = [
            UniqueWithExpressionsConstraint(fields=[],
                                            expressions=[
                                                Coalesce(F('parent'), RawSQL('\'NONE\'', [])),
                                                Lower(F('name'))
                                            ],
                                            name='unique_album_name'),
        ]

if TYPE_CHECKING:
    # pylint: disable=unsubscriptable-object,used-before-assignment
    TagQuerySet = QuerySet[Tag]
else:
    TagQuerySet = QuerySet

class Tag(ModelWithId, ValidatingModel):
    validators = [
        catalog_validator,
        parent_validator,
        name_validator,
    ]

    descendants_manager = CTEManager()

    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='children',
                               null=True)

    def __init__(self, *args, **kwargs) -> None:
        if 'id' not in kwargs:
            kwargs['id'] = uuid('T')

        super().__init__(*args, **kwargs)

    @property
    def path(self) -> List[str]:
        if self.parent:
            path = self.parent.path
            path.append(self.name)
            return path
        return [self.name]

    @staticmethod
    def lock_for_create() -> ContextManager:
        return lock('Tag.create')

    # pylint: disable=bad-whitespace
    @staticmethod
    def get_for_path(catalog: Catalog, path: List[str],
                     match_any: Optional[bool]=None) -> Tag:
        if len(path) == 0:
            raise ApiException('invalid-tag', status=status.HTTP_400_BAD_REQUEST)

        if match_any is None:
            match_any = len(path) == 1

        # Might be a reference to an existing tag.
        if len(path) == 1:
            try:
                # Prefer an unparented tag.
                return Tag.objects.get(catalog=catalog, parent=None, name__iexact=path[0])
            except Tag.DoesNotExist:
                if match_any:
                    tags = Tag.objects.filter(catalog=catalog, name__iexact=path[0])

                    # The easy case...
                    if len(tags) == 1:
                        return tags[0]

                    # This should never happen..
                    if len(tags) > 1:
                        return tags[0]

                # No tag of this name, create it at the top-level.
                return Tag.objects.create(catalog=catalog, name=path[0])

        name = path.pop()
        parent = Tag.get_for_path(catalog, path, match_any)
        (tag, _) = Tag.objects.get_or_create(catalog=catalog, parent=parent, name=name)
        return tag

    def descendants(self) -> TagQuerySet:
        def make_tags_cte(cte):
            return (
                Tag.descendants_manager.filter(id=self.id).values('id') \
                    .union(cte.join(Tag, parent=cte.col.id).values('id'), all=True)
            )

        cte = With.recursive(make_tags_cte)

        return (
            cte.join(Tag, id=cte.col.id).with_cte(cte)
        )

    class Meta:
        constraints = [
            UniqueWithExpressionsConstraint(fields=['catalog'],
                                            expressions=[
                                                Coalesce(F('parent'), RawSQL('\'NONE\'', [])),
                                                Lower(F('name'))
                                            ],
                                            name='unique_tag_name'),
        ]

class Person(ModelWithId, ValidatingModel):
    validators = [
        name_validator,
    ]

    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='people')
    name = models.CharField(max_length=200)

    def __init__(self, *args, **kwargs) -> None:
        if 'id' not in kwargs:
            kwargs['id'] = uuid('P')

        super().__init__(*args, **kwargs)

    @staticmethod
    def lock_for_create() -> ContextManager:
        return lock('Person.create')

    @staticmethod
    def get_for_name(catalog: Catalog, name: str) -> Person:
        person, _ = Person.objects.get_or_create(catalog=catalog, name__iexact=name,
                                                 defaults={
                                                     'name': name,
                                                 })
        return person

    class Meta:
        constraints = [
            UniqueWithExpressionsConstraint(fields=['catalog'],
                                            expressions=[Lower(F('name'))],
                                            name='unique_person_name')
        ]
