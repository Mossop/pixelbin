from django.db import models

class Storage(models.Model):
    def get_storage(self, media):
        return self.backblaze.get_storage(media)

class Backblaze(Storage):
    key_id = models.CharField(max_length=30)
    key = models.CharField(max_length=40)
    bucket = models.CharField(max_length=50)
    path = models.CharField(max_length=200)

    def get_storage(self, media):
        from .backblaze import BackblazeStorage
        return BackblazeStorage(media)

def build_storage(info):
    pass
