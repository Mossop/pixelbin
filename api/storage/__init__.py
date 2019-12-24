from django.db import models

class Server(models.Model):
    @property
    def storage(self):
        # pylint: disable=import-outside-toplevel
        from .server import ServerStorage
        return ServerStorage.build()

class Backblaze(models.Model):
    key_id = models.CharField(max_length=30)
    key = models.CharField(max_length=40)
    bucket = models.CharField(max_length=50)
    path = models.CharField(max_length=200)

    @property
    def storage(self):
        # pylint: disable=import-outside-toplevel
        from .backblaze import BackblazeStorage
        return BackblazeStorage.build(self)
