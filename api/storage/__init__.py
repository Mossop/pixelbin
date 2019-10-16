import os
from shutil import rmtree, copyfile

from django.db import models
import filetype

from base.utils import CONFIG, path

def base_path(media):
    return os.path.join(media.catalog.id, media.id)

def make_target(directory, name):
    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, name)

class BaseStorage:
    def temp_root(self):
        return os.path.join(path(CONFIG.get('path', 'data')), 'storage', 'temp')

    def local_root(self):
        return os.path.join(path(CONFIG.get('path', 'data')), 'storage', 'local')

    def get_temp_path(self, media, name):
        return make_target(os.path.join(self.temp_root(), base_path(media)), name)

    def store_temp(self, media, name, file):
        target = self.get_temp_path(media, name)
        with open(target, 'wb') as output:
            for chunk in file.chunks():
                output.write(chunk)

    def delete_temp(self, media, name):
        target = self.get_temp_path(media, name)
        os.unlink(target)

    def delete_all_temp(self, media):
        target = os.path.join(self.temp_root(), base_path(media))
        rmtree(target)

    def get_local_path(self, media, name):
        return make_target(os.path.join(self.local_root(), base_path(media)), name)

    def store_local_from_temp(self, media, name):
        copyfile(
            self.get_temp_path(media, name),
            self.get_local_path(media, name)
        )

    def delete_local(self, media, name):
        target = self.get_local_path(media, name)
        os.unlink(target)

    def get_public_url(self, media, name):
        raise NotImplementedError("Must implement in class")

    def get_public_stream(self, media, name):
        raise NotImplementedError("Must implement in class")

    def store_public_from_temp(self, media, name):
        raise NotImplementedError("Must implement in class")

    def delete_public(self, media, name):
        raise NotImplementedError("Must implement in class")

    def get_private_url(self, media, name):
        raise NotImplementedError("Must implement in class")

    def get_private_stream(self, media, name):
        raise NotImplementedError("Must implement in class")

    def store_private_from_temp(self, media, name):
        raise NotImplementedError("Must implement in class")

    def delete_private(self, media, name):
        raise NotImplementedError("Must implement in class")

    def delete(self, media):
        raise NotImplementedError("Must implement in class")

class FileStorage(BaseStorage):
    def public_root(self):
        raise NotImplementedError("Must implement in class")

    def public_root_url(self):
        raise NotImplementedError("Must implement in class")

    def private_root(self):
        raise NotImplementedError("Must implement in class")

    def get_public_url(self, media, name):
        return '%s/%s/%s/%s' % (self.public_root_url(), media.catalog.id, media.id, name)

    def get_public_stream(self, media, name):
        target = make_target(os.path.join(self.public_root(), base_path(media)), name)
        return open(target, "rb")

    def store_public_from_temp(self, media, name):
        target = make_target(os.path.join(self.public_root(), base_path(media)), name)
        copyfile(self.get_temp_path(media, name), target)

    def delete_public(self, media, name):
        target = make_target(os.path.join(self.public_root(), base_path(media)), name)
        os.unlink(target)

    def get_private_url(self, media, name):
        return None

    def get_private_stream(self, media, name):
        target = make_target(os.path.join(self.private_root(), base_path(media)), name)
        return open(target, "rb")

    def store_private_from_temp(self, media, name):
        target = make_target(os.path.join(self.private_root(), base_path(media)), name)
        copyfile(self.get_temp_path(media, name), target)

    def delete_private(self, media, name):
        target = make_target(os.path.join(self.private_root(), base_path(media)), name)
        os.unlink(target)

    def delete(self, media):
        self.delete_all_temp(media)
        target = os.path.join(self.local_root(), base_path(media))
        rmtree(target)
        target = os.path.join(self.public_root(), base_path(media))
        rmtree(target)
        target = os.path.join(self.private_root(), base_path(media))
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
