import os
import shutil

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django_cte import CTEManager, With
from django.conf import settings

from .storage import get_storage

class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password = None):
        """
        Creates and saves a User with the given email, fullname and password.
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

    email = models.CharField(max_length=100, primary_key=True)
    full_name = models.CharField(max_length=200)
    username = None
    first_name = None
    last_name = None
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
            "email": self.email,
            "fullname": self.full_name,
        }

    class Meta:
        ordering = ['full_name']

class Catalog(models.Model):
    storage = 'backblaze'
    id = models.CharField(max_length=24, primary_key=True)
    stub = models.CharField(max_length=50)
    name = models.CharField(max_length=100)
    users = models.ManyToManyField(User, related_name='catalogs', through = 'Access')

    def asJS(self):
        return {
            id: self.id,
            stub: self.stub,
            name: self.name,
        }

class Access(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE)
    editable = models.BooleanField()

    class Meta:
        unique_together = (('user', 'catalog'))

class Album(models.Model):
    objects = CTEManager()

    id = models.CharField(max_length=24, primary_key=True)
    stub = models.CharField(max_length=50)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='albums')
    name = models.CharField(max_length=100)
    private = models.BooleanField()
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
            private: self.private,
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

    mimetype = models.CharField(max_length=50)
    width = models.IntegerField()
    height = models.IntegerField()
    storage_id = models.CharField(max_length=200)
    private = models.BooleanField()

    __storage = None

    def storage(self):
        if self.__storage is None:
            self.__storage = get_storage(self)
        return self.__storage

    def delete(self):
        self.storage().delete()
        super().delete()

    def asJS(self):
        return {
            "id": self.id,
            "processed": self.processed,

            "tags": [t.path for t in self.tags.all()],
            "albums": [{id: a.id, stub: a.stub} for a in self.albums.all()],
            "longitude": self.longitude,
            "latitude": self.latitude,
            "taken": self.taken.isoformat(timespec='seconds'),

            "mimetype": self.mimetype,
            "width": self.width,
            "height": self.height,
        }
