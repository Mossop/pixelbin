from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django_cte import CTEManager, With

from .storage import Server, Backblaze
from .utils import uuid

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

    def delete(self, using=None, keep_parents=False):
        super().delete(using, keep_parents)
        Catalog.objects.filter(users=None).delete()

    def get_full_name(self):
        return self.full_name

    class Meta:
        ordering = ['full_name']

class Catalog(models.Model):
    id = models.CharField(max_length=24, primary_key=True)
    name = models.CharField(max_length=100)
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

    def delete(self, using=None, keep_parents=False):
        super().delete(using, keep_parents)
        Backblaze.objects.filter(catalogs=None).delete()
        Server.objects.filter(catalogs=None).delete()

class Access(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access')
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
                Album.objects.filter(id=self.id).values("id") \
                    .union(cte.join(Tag, parent=cte.col.id).values("id"), all=True)
            )

        cte = With.recursive(make_albums_cte)

        return (
            cte.join(Album, id=cte.col.id).with_cte(cte)
        )

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

    @staticmethod
    def get_from_path(catalog, path):
        parent = None
        while len(path) > 0:
            name = path.pop(0)
            (parent,) = Tag.objects.get_or_create(parent=parent, catalog=catalog, name__iexact=name)
        return parent

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

    class Meta:
        unique_together = (('catalog', 'parent', 'name'))

class Person(models.Model):
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='people')
    full_name = models.CharField(max_length=200)

    @staticmethod
    def get_from_name(catalog, name):
        (person,) = Person.objects.get_or_create(catalog=catalog, full_name__iexact=name)
        return person

    class Meta:
        unique_together = (('catalog', 'full_name'))

class Media(models.Model):
    id = models.CharField(max_length=24, primary_key=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='media')
    processed = models.BooleanField(default=False)
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
        return self.catalog.storage

    def process(self):
        pass

    def delete(self, using=None, keep_parents=False):
        self.storage.delete(self)
        super().delete(using, keep_parents)
