from __future__ import annotations

import os
from typing import Callable

from django.db import models

from .base import ModelWithId
from .catalog import Catalog, Tag, Album, Person
from ..storage.base import BaseFileStore, InnerFileStore
from ..utils import ValidatingModel, uuid, ApiException
from ..metadata import add_metadata_fields_to_model, MediaMetadata

class Media(ModelWithId):
    # Cannot be changed after upload.
    catalog = models.ForeignKey(Catalog, null=False, on_delete=models.CASCADE, related_name='media')
    created = models.DateTimeField(auto_now_add=True)

    # Fields required for the storage system. Should not be exposed to the API.
    storage_id = models.CharField(max_length=200, default='', blank=True)
    new_file = models.BooleanField(null=False, default=False)

    # Relationships. Entirely under API control.
    tags = models.ManyToManyField(Tag, related_name='media', through='MediaTag')
    albums = models.ManyToManyField(Album, related_name='media', through='MediaAlbum')
    people = models.ManyToManyField(Person, related_name='media', through='MediaPerson')

    _metadata = None
    _file_store = None

    def __init__(self, *args, **kwargs) -> None:
        if 'id' not in kwargs:
            kwargs['id'] = uuid('M')

        super().__init__(*args, **kwargs)

    @property
    def metadata(self) -> MediaMetadata:
        if self._metadata is None:
            self._metadata = MediaMetadata(self)
        return self._metadata

    @property
    def file_store(self) -> BaseFileStore:
        if self._file_store is None:
            self._file_store = InnerFileStore(self.catalog.file_store,
                                              os.path.join(self.catalog.id, self.id))
        return self._file_store

    def delete(self, **kwargs):
        self.file_store.delete()
        super().delete(**kwargs)

add_metadata_fields_to_model(Media)

class MediaInfo(models.Model):
    media = models.OneToOneField(Media, on_delete=models.CASCADE,
                                 related_name='info', null=False)

    # Fields generated from the media file.
    process_version = models.IntegerField(null=False, default=None)
    uploaded = models.DateTimeField(null=False)
    mimetype = models.CharField(null=False, blank=False, max_length=50)
    width = models.IntegerField(null=False, default=None)
    height = models.IntegerField(null=False, default=None)
    duration = models.FloatField(null=True, default=None)
    file_size = models.IntegerField(null=False, default=None)

def validate_matching_catalog(*fields) -> Callable[[models.Model], None]:
    def validator(obj: models.Model):
        catalog = getattr(obj, fields[0]).catalog
        for field in fields[1:]:
            if getattr(obj, field).catalog != catalog:
                raise ApiException('catalog-mismatch')

    return validator

class MediaTag(ValidatingModel):
    validators = [
        validate_matching_catalog('media', 'tag'),
    ]

    media = models.ForeignKey(Media, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['media', 'tag'], name='unique_tags')
        ]

class MediaAlbum(ValidatingModel):
    validators = [
        validate_matching_catalog('media', 'album'),
    ]

    media = models.ForeignKey(Media, on_delete=models.CASCADE)
    album = models.ForeignKey(Album, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['media', 'album'], name='unique_albums')
        ]

class MediaPerson(ValidatingModel):
    validators = [
        validate_matching_catalog('media', 'person'),
    ]

    media = models.ForeignKey(Media, on_delete=models.CASCADE)
    person = models.ForeignKey(Person, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['media', 'person'], name='unique_people')
        ]
