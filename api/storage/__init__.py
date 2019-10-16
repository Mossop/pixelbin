from shutil import rmtree
from os import makedirs

from django.db import models
import filetype

def base_path(media):
    return '%s/%s' % (media.catalog.id, media.id)

def make_target(directory, name):
    makedirs(directory, exist_ok=True)
    return '%s/%s' % (directory, name)

class FileStorage:
    def private_root(self):
        raise NotImplementedError("Must implement in class")

    def temp_root(self):
        raise NotImplementedError("Must implement in class")

    def public_root(self):
        raise NotImplementedError("Must implement in class")

    def store_file(self, media, file):
        target = make_target('%s/%s' % (self.public_root(), base_path(media)), media.filename)
        with open(target, 'wb') as output:
            for chunk in file.chunks():
                output.write(chunk)

    def delete(self, media):
        target = '%s/%s' % (self.private_root(), base_path(media))
        rmtree(target)
        target = '%s/%s' % (self.temp_root(), base_path(media))
        rmtree(target)
        target = '%s/%s' % (self.public_root(), base_path(media))
        rmtree(target)

class Server(models.Model):
    @property
    def storage(self):
        from .server import ServerStorage
        return ServerStorage.build()

class Backblaze(models.Model):
    key_id = models.CharField(max_length=30)
    key = models.CharField(max_length=40)
    bucket = models.CharField(max_length=50)
    path = models.CharField(max_length=200)

    @property
    def storage(self):
        from .backblaze import BackblazeStorage
        return BackblazeStorage.build(self)
