from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django_cte import CTEManager, With

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
    objects = CTEManager()
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tags')
    name = models.TextField()
    parent = models.ForeignKey('self',
                               on_delete=models.CASCADE,
                               related_name='children',
                               null=True)

    @property
    def path(self):
        if self.parent:
            return '%s/%s' % (self.parent.path, self.name)
        return self.name

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

    class Meta:
        unique_together = (('name', 'parent'))

def choose_upload_path(instance, filename):
    return '%s/%s' % (instance.owner.id, filename)

class Media(models.Model):
    TYPE_UNKNOWN = 0
    TYPE_IMAGE = 1
    TYPE_VIDEO = 2
    CHOICES = (
        (TYPE_IMAGE, 'Image'),
        (TYPE_VIDEO, 'Video'),
    )

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='media')
    file = models.FileField(upload_to=choose_upload_path)
    tags = models.ManyToManyField(Tag, related_name='media')
    longitude = models.FloatField(null=True)
    latitude = models.FloatField(null=True)
    taken = models.DateTimeField()
    type = models.PositiveSmallIntegerField(choices=CHOICES)

    def asJS(self):
        return {
            "id": self.id,
            "longitude": self.longitude,
            "latitude": self.latitude,
            "date": self.taken.isoformat(timespec='seconds'),
            "tags": [t.path for t in self.tags.all()],
            "type": self.type,
        }
