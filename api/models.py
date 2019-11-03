import subprocess
import json

from django.db import models, transaction
from django.db.models.expressions import Q
from django.db.models.functions import Lower
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django_cte import CTEManager, With
from rest_framework import status
from PIL import Image

from .storage import Server, Backblaze
from .storage.base import MediaStorage
from .utils import ApiException

from .utils import uuid

THUMB_SIZES = [
    150,
    200,
    300,
    400,
    500,
]

def resize(image, size):
    if image.width <= size and image.height <= size:
        return image.copy()
    if image.width > image.height:
        factor = size / image.width
        return image.resize((size, round(image.height * factor)), Image.LANCZOS)
    factor = size / image.height
    return image.resize((round(image.width * factor), size), Image.LANCZOS)

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

    id = models.CharField(max_length=30, primary_key=True)
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
    id = models.CharField(max_length=30, primary_key=True)
    users = models.ManyToManyField(User, related_name='catalogs', through='Access')

    backblaze = models.ForeignKey(Backblaze, blank=True, null=True,
                                  on_delete=models.CASCADE, related_name='catalogs')
    server = models.ForeignKey(Server, blank=True, null=True,
                               on_delete=models.CASCADE, related_name='catalogs')

    @property
    def storage(self):
        if self.backblaze is not None:
            return self.backblaze.storage
        if self.server is not None:
            return self.server.storage
        raise RuntimeError("Unreachable")

    @property
    def root(self):
        return self.albums.get(parent__isnull=True)

    def delete(self, using=None, keep_parents=False):
        self.root.delete()
        super().delete(using, keep_parents)
        Backblaze.objects.filter(catalogs__isnull=True).delete()
        Server.objects.filter(catalogs__isnull=True).delete()

class Access(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access')
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'catalog'], name='unique_owners')
        ]

class Album(models.Model):
    objects = CTEManager()

    id = models.CharField(max_length=30, primary_key=True)
    stub = models.CharField(max_length=50, unique=True, default=None, blank=False, null=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='albums')
    name = models.CharField(max_length=100, blank=False)
    lc_name = models.CharField(max_length=100, blank=False)
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

    def save(self, *args, **kwargs):
        self.lc_name = self.name.lower()
        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(lc_name=Lower('name')),
                                   name='ensure_album_lc_name_correct'),
            models.UniqueConstraint(fields=['catalog'], condition=Q(parent__isnull=True),
                                    name='single_root_album'),
            models.UniqueConstraint(fields=['catalog', 'parent', 'lc_name'],
                                    name='unique_album_name'),
        ]

class Tag(models.Model):
    objects = CTEManager()

    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='tags')
    name = models.CharField(max_length=100)
    lc_name = models.CharField(max_length=100)
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
    @transaction.atomic
    def get_from_path(catalog, path):
        if len(path) == 0:
            raise ApiException('invalid-tag', status=status.HTTP_400_BAD_REQUEST)

        if len(path) == 1:
            try:
                return Tag.objects.get(catalog=catalog, lc_name=path[0].lower(), parent=None)
            except Tag.DoesNotExist:
                try:
                    return Tag.objects.filter(catalog=catalog, lc_name=path[0].lower())[0]
                except IndexError:
                    tag = Tag(catalog=catalog, name=path[0], lc_name=path[0].lower(), parent=None)
                    tag.save()
                    return tag

        name = path.pop(0)
        tag, _ = Tag.objects.get_or_create(catalog=catalog, lc_name=name.lower(),
                                           parent=None, defaults={'name': name})
        while len(path) > 0:
            name = path.pop(0)
            tag, _ = Tag.objects.get_or_create(catalog=catalog, lc_name=name.lower(),
                                               parent=tag, defaults={'name': name})

        return tag

    def descendants(self):
        def make_tags_cte(cte):
            return (
                Tag.objects.filter(id=self.id).values("id") \
                    .union(cte.join(Tag, parent=cte.col.id).values("id"), all=True)
            )

        cte = With.recursive(make_tags_cte)

        return (
            cte.join(Tag, id=cte.col.id).with_cte(cte)
        )

    def save(self, *args, **kwargs):
        self.lc_name = self.name.lower()
        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(lc_name=Lower('name')),
                                   name='ensure_tag_lc_name_correct'),
            models.UniqueConstraint(fields=['catalog', 'parent', 'lc_name'],
                                    name='unique_tag_name'),
        ]

class Person(models.Model):
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='people')
    full_name = models.CharField(max_length=200)
    lc_name = models.CharField(max_length=200)

    @staticmethod
    def get_from_name(catalog, name):
        lower = name.lower()
        (person,) = Person.objects.get_or_create(catalog=catalog, lc_name=lower, defaults={
            "full_name": name,
        })
        return person

    def save(self, *args, **kwargs):
        self.lc_name = self.full_name.lower()
        super().save(*args, **kwargs)

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(lc_name=Lower('full_name')),
                                   name='ensure_person_lc_name_correct'),
            models.UniqueConstraint(fields=['catalog', 'lc_name'], name='unique_person_name')
        ]

class Media(models.Model):
    id = models.CharField(max_length=30, primary_key=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='media')
    processed = models.BooleanField(default=False)
    title = models.CharField(max_length=200, blank=True)
    filename = models.CharField(max_length=50, blank=True)

    tags = models.ManyToManyField(Tag, related_name='media')
    albums = models.ManyToManyField(Album, related_name='media')
    people = models.ManyToManyField(Person, related_name='media')

    longitude = models.FloatField(null=True)
    latitude = models.FloatField(null=True)
    taken = models.DateTimeField(null=True)

    uploaded = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now_add=True)
    mimetype = models.CharField(max_length=50)
    width = models.IntegerField(default=0)
    height = models.IntegerField(default=0)
    orientation = models.IntegerField(default=1)

    storage_filename = models.CharField(max_length=50)
    storage_id = models.CharField(max_length=200, default="", blank=True)

    @property
    def storage(self):
        return MediaStorage(self.catalog.storage, self)

    @property
    def is_image(self):
        return self.mimetype[0:6] == 'image/'

    @property
    def is_video(self):
        return self.mimetype[0:6] == 'video/'

    def import_metadata(self, data):
        if 'MIMEType' in data:
            self.mimetype = data['MIMEType']

    def thumbnail(self, size):
        for thumbsize in THUMB_SIZES:
            if thumbsize >= size:
                path = self.storage.get_local_path('sized%d.jpg' % (thumbsize))
                image = Image.open(path)
                return resize(image, size)

        thumbsize = THUMB_SIZES[-1]
        path = self.storage.get_local_path('sized%d.jpg' % (thumbsize))
        image = Image.open(path)
        return resize(image, size)


    def process(self):
        if self.processed:
            return

        source = self.storage.get_temp_path(self.storage_filename)
        result = subprocess.run(['exiftool', '-json', source], capture_output=True,
                                timeout=10, check=True)
        metadata = json.loads(result.stdout)
        if len(metadata) != 1:
            return
        self.import_metadata(metadata[0])
        meta_file = self.storage.get_local_path('metadata.json')
        output = open(meta_file, 'w')
        json.dump(metadata[0], output, indent=2)
        output.close()

        if self.is_image:
            image = Image.open(source)
            self.width = image.width
            self.height = image.height
            for size in THUMB_SIZES:
                resized = resize(image, size)
                target = self.storage.get_local_path('sized%d.jpg' % (size))
                resized.save(target, None, quality=95, optimize=True)

        self.processed = True
        self.storage.delete_all_temp()

    def delete(self, using=None, keep_parents=False):
        self.storage.delete()
        super().delete(using, keep_parents)
