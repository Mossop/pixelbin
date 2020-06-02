import os
from django.db import models
from django.db.models.expressions import F
from django.db.models.functions import Coalesce, Lower
from django.db.models.expressions import RawSQL
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser
from django_cte import CTEManager, With
from rest_framework import status

from .locks import lock
from .storage.models import Storage
from .storage.base import InnerFileStore
from .utils import uuid, ApiException, ValidatingModel
from .constraints import UniqueWithExpressionsConstraint
from .metadata import MediaMetadata, add_metadata_fields_to_model

class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None):
        """
        Creates and saves a User with the given email, name and password.
        """
        if not email:
            raise ValueError('Users must have an email address')

        user = self.model(
            email=self.normalize_email(email),
            full_name=full_name,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password):
        """
        Creates and saves a superuser with the given email, name and password.
        """
        user = self.create_user(
            email=self.normalize_email(email),
            password=password,
            full_name=full_name,
        )
        user.is_superuser = True
        user.is_staff = True
        user.verified = True
        user.save(using=self._db)
        return user

class User(AbstractBaseUser):
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200)
    had_catalog = models.BooleanField(default=False)
    verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    def __init__(self, *args, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = uuid('U')

        super().__init__(*args, **kwargs)

    def __str__(self):
        return self.email

    def delete(self, using=None, keep_parents=False):
        super().delete(using, keep_parents)
        Catalog.objects.filter(users__isnull=True).delete()

    def get_full_name(self):
        return self.full_name

    def _can_access_catalog(self, catalog):
        return Access.objects.filter(catalog=catalog, user=self).exists()

    def check_can_see(self, catalog):
        if not self._can_access_catalog(catalog):
            raise ApiException('not-found', status=status.HTTP_404_NOT_FOUND)

    def check_can_modify(self, catalog):
        self.check_can_see(catalog)

        if not self._can_access_catalog(catalog):
            raise ApiException('not-allowed', status=status.HTTP_403_FORBIDDEN)

    class Meta:
        ordering = ['full_name']

class Catalog(models.Model):
    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    name = models.CharField(max_length=100, blank=False)
    users = models.ManyToManyField(User, related_name='catalogs', through='Access')
    storage = models.ForeignKey(Storage, null=False,
                                on_delete=models.CASCADE, related_name='catalogs')

    def __init__(self, *args, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = uuid('C')

        super().__init__(*args, **kwargs)

    @property
    def file_store(self):
        return self.storage.file_store

class Access(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'catalog'], name='unique_owners')
        ]

def catalog_validator(related_field):
    def validator(obj):
        related_obj = getattr(obj, related_field)

        if related_obj is None:
            return

        if getattr(obj, related_field).catalog != obj.catalog:
            raise ApiException('catalog-mismatch')
    return validator

def parent_validator(obj):
    parent = obj.parent
    while parent is not None:
        if parent.id == obj.id:
            raise ApiException('cyclic-structure')
        parent = parent.parent


def name_validator(obj):
    filters = {
        'catalog': obj.catalog,
        'name__iexact': obj.name,
    }

    if hasattr(obj, 'parent'):
        filters['parent'] = obj.parent

    siblings = obj.__class__.objects.exclude(id=obj.id).filter(**filters)

    if siblings.exists():
        raise ApiException('invalid-name')

class Album(ValidatingModel):
    validators = [
        catalog_validator('parent'),
        parent_validator,
        name_validator,
    ]

    descendants_manager = CTEManager()

    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    stub = models.CharField(max_length=50, unique=True, default=None, blank=False, null=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='albums')
    name = models.CharField(max_length=100, blank=False)
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='albums',
                               null=True)

    def __init__(self, *args, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = uuid('A')

        super().__init__(*args, **kwargs)

    def descendants(self):
        def make_albums_cte(cte):
            return (
                Album.descendants_manager.filter(id=self.id).values("id") \
                    .union(cte.join(Album, parent=cte.col.id).values("id"), all=True)
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

class Tag(ValidatingModel):
    validators = [
        catalog_validator('parent'),
        parent_validator,
        name_validator,
    ]

    descendants_manager = CTEManager()

    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='children',
                               null=True)

    def __init__(self, *args, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = uuid('T')

        super().__init__(*args, **kwargs)

    @property
    def path(self):
        if self.parent:
            path = self.parent.path
            path.append(self.name)
            return path
        return [self.name]

    @staticmethod
    def lock_for_create():
        return lock('Tag.create')

    @staticmethod
    def get_for_path(catalog, path, match_any=None):
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
                return catalog.tags.create(name=path[0])

        name = path.pop()
        parent = Tag.get_for_path(catalog, path, match_any)
        (tag, _) = Tag.objects.get_or_create(catalog=catalog, parent=parent, name=name)
        return tag

    def descendants(self):
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

class Person(ValidatingModel):
    validators = [
        name_validator,
    ]

    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='people')
    name = models.CharField(max_length=200)

    def __init__(self, *args, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = uuid('P')

        super().__init__(*args, **kwargs)

    @staticmethod
    def lock_for_create():
        return lock('Person.create')

    @staticmethod
    def get_for_name(catalog, name):
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

class Media(models.Model):
    # Cannot be changed after upload.
    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    catalog = models.ForeignKey(Catalog, null=False, on_delete=models.CASCADE, related_name='media')
    created = models.DateTimeField(auto_now_add=True)

    # Fields required for the storage system. Should not be exposed to the API.
    storage_id = models.CharField(max_length=200, default="", blank=True)
    new_file = models.BooleanField(null=False, default=False)

    # Relationships. Entirely under API control.
    tags = models.ManyToManyField(Tag, related_name='media', through='MediaTag')
    albums = models.ManyToManyField(Album, related_name='media', through='MediaAlbum')
    people = models.ManyToManyField(Person, related_name='media', through='MediaPerson')

    _metadata = None
    _file_store = None

    def __init__(self, *args, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = uuid('M')

        super().__init__(*args, **kwargs)

    @property
    def metadata(self):
        if self._metadata is None:
            self._metadata = MediaMetadata(self)
        return self._metadata

    @property
    def file_store(self):
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

def validate_matching_catalog(*fields):
    def validator(obj):
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

    def save(self, *args, **kwargs):
        if self.media.catalog != self.album.catalog:
            raise ApiException('catalog-mismatch')

        super().save(*args, **kwargs)

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

    def save(self, *args, **kwargs):
        if self.media.catalog != self.person.catalog:
            raise ApiException('catalog-mismatch')

        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['media', 'person'], name='unique_people')
        ]
