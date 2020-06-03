from __future__ import annotations

from typing import Optional

from django.db import models
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser
from rest_framework import status

from .catalog import Catalog
from ..utils import uuid, ApiException

class UserManager(BaseUserManager):
    # pylint: disable=bad-whitespace
    def create_user(self, email: str, full_name: str, password: Optional[str]=None) -> User:
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
    catalogs = models.ManyToManyField(Catalog, related_name='users', through='Access')

    def __init__(self, *args, **kwargs) -> None:
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

    def _can_access_catalog(self, catalog: Catalog) -> bool:
        return Access.objects.filter(catalog=catalog, user=self).exists()

    def check_can_see(self, catalog: Catalog) -> None:
        if not self._can_access_catalog(catalog):
            raise ApiException('not-found', status=status.HTTP_404_NOT_FOUND)

    def check_can_modify(self, catalog: Catalog) -> None:
        self.check_can_see(catalog)

        if not self._can_access_catalog(catalog):
            raise ApiException('not-allowed', status=status.HTTP_403_FORBIDDEN)

    class Meta:
        ordering = ['full_name']

class Access(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'catalog'], name='unique_owners')
        ]
