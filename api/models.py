from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None):
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
        user.save(using=self._db)
        return user

class User(AbstractUser):
    USERNAME_FIELD = 'email'
    EMAIL_FIELD = 'email'
    REQUIRED_FIELDS=['full_name']

    objects = UserManager()

    email = models.CharField(max_length=100, unique=True)
    full_name = models.CharField(max_length=200, unique=True)
    username = None
    first_name = None
    last_name = None

    def __str__(self):
        return self.email

    def get_full_name(self):
        return self.full_name

    class Meta:
        ordering = ['full_name']

class Tag(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tags')
    name = models.TextField()
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='children',
                               null=True)

    class Meta:
        unique_together = (('name', 'parent'))

class Media(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media')
    file = models.FileField()
    tags = models.ManyToManyField(Tag, related_name='media')
    longitude = models.FloatField(null=True)
    latitude = models.FloatField(null=True)
    taken = models.DateField()
