import os
import shutil

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django_cte import CTEManager, With
from django.conf import settings

from .storage import *
from .utils import uuid

class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password = None):
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
    REQUIRED_FIELDS=['full_name']

    objects = UserManager()

    id = models.CharField(max_length=24, primary_key=True)
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

    def delete(self):
        super().delete()
        Catalog.objects.filter(users = None).delete()

    def get_full_name(self):
        return self.full_name

    def asJS(self):
        return {
            "id": self.id,
            "email": self.email,
            "fullname": self.full_name,
            "hadCatalog": self.had_catalog,
        }

    class Meta:
        ordering = ['full_name']

class Catalog(models.Model):
    id = models.CharField(max_length=24, primary_key=True)
    name = models.CharField(max_length=100)
    users = models.ManyToManyField(User, related_name='catalogs', through = 'Access')
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='catalogs')

    def delete(self):
        super().delete()
        Storage.objects.filter(catalogs = None).delete()

    def asJS(self):
        return {
            id: self.id,
            name: self.name,
        }

class Access(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE)

    class Meta:
        unique_together = (('user', 'catalog'))

class Album(models.Model):
    objects = CTEManager()

    id = models.CharField(max_length=24, primary_key=True)
    stub = models.CharField(max_length=50, unique=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='albums')
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='albums',
                               null=True)

    def descendants(self):
        def make_albums_cte(cte):
            return (
                Album.objects.filter(id=self.id)
                             .values("id")
                             .union(cte.join(Tag, parent=cte.col.id).values("id"), all=True)
            )

        cte = With.recursive(make_albums_cte)

        return (
            cte.join(Album, id=cte.col.id)
               .with_cte(cte)
        )

    def asJS(self):
        return {
            id: self.id,
            stub: self.stub,
            name: self.name,
        }

    class Meta:
        unique_together = (('catalog', 'id'))
        unique_together = (('catalog', 'parent', 'name'))

class Tag(models.Model):
    objects = CTEManager()

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

    def descendants(self):
        def make_tags_cte(cte):
            return (
                Tag.objects.filter(id=self.id)
                           .values("id")
                           .union(cte.join(Tag, parent=cte.col.id).values("id"), all=True)
            )

        cte = With.recursive(make_tags_cte)

        return (
            cte.join(Tag, id=cte.col.id)
               .with_cte(cte)
        )

    def asJS(self):
        return {
            "name": self.name,
            "path": self.path,
        }

    class Meta:
        unique_together = (('catalog', 'parent', 'name'))

class Media(models.Model):
    id = models.CharField(max_length=24, primary_key=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='media')
    processed = models.BooleanField()

    tags = models.ManyToManyField(Tag, related_name='media')
    albums = models.ManyToManyField(Album, related_name='media')
    longitude = models.FloatField(null=True)
    latitude = models.FloatField(null=True)
    taken = models.DateTimeField()

    uploaded = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now_add=True)
    mimetype = models.CharField(max_length=50)
    width = models.IntegerField()
    height = models.IntegerField()
    storage_id = models.CharField(max_length=200)

    __storage = None

    def storage(self):
        if self.__storage is None:
            self.__storage = self.catalog.storage.get_storage(self)
        return self.__storage

    def delete(self):
        self.storage().delete()
        super().delete()
