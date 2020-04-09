
import os
from shutil import rmtree, copyfile

from base.config import PATHS

def base_path(media):
    return os.path.join(media.catalog.id, media.id)

def make_target(directory, name):
    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, name)

class BaseFileStore:
    def temp_root(self):
        return os.path.join(PATHS.get('data'), 'storage', 'temp')

    def local_root(self):
        return os.path.join(PATHS.get('data'), 'storage', 'local')

    def get_temp_path(self, media, name):
        return make_target(os.path.join(self.temp_root(), base_path(media)), name)

    def delete_all_temp(self, media):
        target = os.path.join(self.temp_root(), base_path(media))
        rmtree(target, True)

    def get_local_path(self, media, name):
        return make_target(os.path.join(self.local_root(), base_path(media)), name)

    def store_local_from_temp(self, media, name, target=None):
        if target is None:
            target = name
        copyfile(
            self.get_temp_path(media, name),
            self.get_local_path(media, target)
        )

    def delete_local(self, media, name):
        target = self.get_local_path(media, name)
        os.unlink(target)

    def get_storage_stream(self, media, name):
        raise NotImplementedError("Must implement in class")

    def store_storage_from_temp(self, media, name, target=None):
        raise NotImplementedError("Must implement in class")

    def delete_storage(self, media, name):
        raise NotImplementedError("Must implement in class")

    def delete(self, media):
        raise NotImplementedError("Must implement in class")

class MediaFileStore:
    def __init__(self, file_store, media):
        self.file_store = file_store
        self.media = media

    def get_temp_path(self, name):
        return self.file_store.get_temp_path(self.media, name)

    def delete_all_temp(self):
        self.file_store.delete_all_temp(self.media)

    def get_local_path(self, name):
        return self.file_store.get_local_path(self.media, name)

    def store_local_from_temp(self, name, target=None):
        self.file_store.store_local_from_temp(self.media, name, target)

    def delete_local(self, name):
        self.file_store.delete_local(self.media, name)

    def get_storage_stream(self, name):
        return self.file_store.get_public_stream(self.media, name)

    def store_storage_from_temp(self, name, target=None):
        self.file_store.store_storage_from_temp(self.media, name, target)

    def delete_storage(self, name):
        self.file_store.delete_public(self.media, name)

    def delete(self):
        self.file_store.delete(self.media)

class LocalFileStore(BaseFileStore):
    def storage_root(self):
        raise NotImplementedError("Must implement in class")

    def get_storage_stream(self, media, name):
        target = make_target(os.path.join(self.storage_root(), base_path(media)), name)
        return open(target, "rb")

    def store_storage_from_temp(self, media, name, target=None):
        if target is None:
            target = name
        target = make_target(os.path.join(self.storage_root(), base_path(media)), target)
        copyfile(self.get_temp_path(media, name), target)

    def delete_storage(self, media, name):
        target = make_target(os.path.join(self.storage_root(), base_path(media)), name)
        os.unlink(target)

    def delete(self, media):
        self.delete_all_temp(media)
        target = os.path.join(self.local_root(), base_path(media))
        rmtree(target)
        target = os.path.join(self.storage_root(), base_path(media))
        rmtree(target)
