from django.db import models, IntegrityError
from django.db.models.expressions import Q, F
from django.db.models.functions import Lower
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django_cte import CTEManager, With
from rest_framework import status

from .locks import lock
from .storage.models import Storage
from .storage.base import MediaFileStore
from .utils import uuid, ApiException
from .constraints import UniqueWithExpressionsConstraint
from .metadata import MediaMetadata, get_metadata_fields

class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None):
        """
        Creates and saves a User with the given email, fullname and password.
        """
        if not email:
            raise ValueError('Users must have an email address')

        user = self.model(
            id=uuid("U"),
            email=self.normalize_email(email),
            full_name=full_name,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password):
        """
        Creates and saves a superuser with the given email, fullname and password.
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

class User(AbstractUser):
    USERNAME_FIELD = 'email'
    EMAIL_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200)
    username = None
    first_name = None
    last_name = None
    had_catalog = models.BooleanField(default=False)
    verified = models.BooleanField(default=False)
    last_seen = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.email

    def delete(self, using=None, keep_parents=False):
        super().delete(using, keep_parents)
        Catalog.objects.filter(users__isnull=True).delete()

    def get_full_name(self):
        return self.full_name

    def can_access_catalog(self, catalog):
        return Access.objects.filter(catalog=catalog, user=self).exists()

    class Meta:
        ordering = ['full_name']

class Catalog(models.Model):
    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    users = models.ManyToManyField(User, related_name='catalogs', through='Access')
    storage = models.ForeignKey(Storage, null=False,
                                on_delete=models.CASCADE, related_name='catalogs')

    @property
    def root(self):
        return self.albums.get(parent__isnull=True)

    @property
    def file_store(self):
        return self.storage.file_store

class Access(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access')
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'catalog'], name='unique_owners')
        ]

class Album(models.Model):
    objects = CTEManager()

    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    stub = models.CharField(max_length=50, unique=True, default=None, blank=False, null=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='albums')
    name = models.CharField(max_length=100, blank=False)
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='albums',
                               null=True)

    def descendants(self):
        def make_albums_cte(cte):
            return (
                Album.objects.filter(id=self.id).values("id") \
                    .union(cte.join(Album, parent=cte.col.id).values("id"), all=True)
            )

        cte = With.recursive(make_albums_cte)

        return (
            cte.join(Album, id=cte.col.id).with_cte(cte)
        )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['catalog'], condition=Q(parent__isnull=True),
                                    name='single_root_album'),
            UniqueWithExpressionsConstraint(fields=['catalog', 'parent'],
                                            expressions=[Lower(F('name'))],
                                            name='unique_album_name'),
        ]

class Tag(models.Model):
    objects = CTEManager()

    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='children',
                               null=True)

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
    def get_for_path(catalog, path):
        if len(path) == 0:
            raise ApiException('invalid-tag', status=status.HTTP_400_BAD_REQUEST)

        if len(path) == 1:
            tag, _ = Tag.objects.get_or_create(catalog=catalog, name__iexact=path[0],
                                               defaults={
                                                   'id': uuid('T'),
                                                   'name': path[0],
                                                   'parent': None
                                               })
            return tag

        name = path.pop(0)
        try:
            tag, _ = Tag.objects.get_or_create(catalog=catalog, name__iexact=name,
                                               parent=None, defaults={
                                                   'id': uuid('T'),
                                                   'name': name,
                                               })
            while len(path) > 0:
                name = path.pop(0)
                tag, _ = Tag.objects.get_or_create(catalog=catalog, name__iexact=name,
                                                   parent=tag, defaults={
                                                       'id': uuid('T'),
                                                       'name': name,
                                                   })

            return tag
        except IntegrityError:
            raise ApiException('invalid-tag', name, status=status.HTTP_400_BAD_REQUEST)

    def descendants(self):
        def make_tags_cte(cte):
            return (
                Tag.objects.filter(id=self.id).values('id') \
                    .union(cte.join(Tag, parent=cte.col.id).values('id'), all=True)
            )

        cte = With.recursive(make_tags_cte)

        return (
            cte.join(Tag, id=cte.col.id).with_cte(cte)
        )

    class Meta:
        constraints = [
            UniqueWithExpressionsConstraint(fields=['catalog'],
                                            expressions=[Lower(F('name'))],
                                            name='unique_tag_name'),
        ]

class Person(models.Model):
    id = models.CharField(max_length=30, primary_key=True, blank=False, null=False)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='people')
    fullname = models.CharField(max_length=200)

    @staticmethod
    def lock_for_create():
        return lock('Person.create')

    @staticmethod
    def get_for_name(catalog, name):
        person, _ = Person.objects.get_or_create(catalog=catalog, fullname__iexact=name,
                                                 defaults={
                                                     'id': uuid('P'),
                                                     'fullname': name,
                                                 })
        return person

    class Meta:
        constraints = [
            UniqueWithExpressionsConstraint(fields=['catalog'],
                                            expressions=[Lower(F('fullname'))],
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

    # Fields generated from the media file.
    process_version = models.IntegerField(null=True, default=None)
    uploaded = models.DateTimeField(null=True)
    mimetype = models.CharField(null=True, blank=False, max_length=50)
    width = models.IntegerField(null=True, default=None)
    height = models.IntegerField(null=True, default=None)
    duration = models.FloatField(null=True, default=None)
    file_size = models.IntegerField(null=True, default=None)

    # Relationships. Entirely under API control.
    tags = models.ManyToManyField(Tag, related_name='media')
    albums = models.ManyToManyField(Album, related_name='media')
    people = models.ManyToManyField(Person, related_name='media')

    _metadata = None
    _file_store = None

    @property
    def metadata(self):
        if self._metadata is None:
            self._metadata = MediaMetadata(self)
        return self._metadata

    @property
    def file_store(self):
        if self._file_store is None:
            self._file_store = MediaFileStore(self.catalog.file_store, self)
        return self._file_store

    def delete(self, using=None, keep_parents=False):
        self.file_store.delete()
        super().delete(using, keep_parents)

for field in get_metadata_fields():
    field.add_to_model(Media)
