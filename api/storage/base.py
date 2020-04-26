
import os
from shutil import rmtree, copyfile

class BaseStorageArea:
    """The basic API all file stores must implement.
    """
    def get_stream(self, path): # pylint: disable=unused-argument
        """Returns a stream to read the named file.

        Returning None indicates that this storage system does not support
        streaming data from files and the caller shouldf use get_url instead.
        """
        return None

    def get_url(self, path): # pylint: disable=unused-argument
        """Returns a globally accessible url for the named file.

        Returning None indicates that this storage system does not support
        urls for files and the caller shouldf use get_stream instead.
        """
        return None

    def delete(self, path=""):
        """Deletes the named path from storage."""
        raise NotImplementedError("%s must implement delete." %
                                  self.__class__.__name__)

class LocalStorageArea(BaseStorageArea):
    """The API that the temp and local storage areas implement."""
    def __init__(self, root):
        self._root = root
        os.makedirs(root, exist_ok=True)

    def get_path(self, path):
        """Gets a local file path for the named file."""
        if path == "":
            return self._root
        return os.path.join(self._root, path)

    def get_stream(self, path):
        return open(self.get_path(path), "rb")

    def delete(self, path=""):
        target = self.get_path(path)
        if not os.path.exists(target):
            return
        if os.path.isdir(target):
            rmtree(target, True)
            if target == self._root:
                os.makedirs(target, exist_ok=True)
        else:
            os.unlink(target)

class BaseFileStore:
    """An abstract file storage system.

    A file store exposes three different storage areas. Temporary, local and
    main. The temporary and local storage areas are expected to exist somewhere
    locally on the server while main may exist somewhere else. As such it is
    expected to be possible to get a local path to a file in the temporary and
    local storage areas but not for the main storage area. The only way to put
    files into the main storage area is by copying them from either the
    temporary or local storage areas.

    Storage areas are shared spaces and may be used by various catalogs, media
    etc. and so care must be taken to use unique naming. See InnerFileStore for
    a straightforward way to handle this.
    """
    def __init__(self, temp_storage, local_storage, main_storage):
        self._temp = temp_storage
        self._local = local_storage
        self._main = main_storage

    @property
    def temp(self):
        return self._temp

    @property
    def local(self):
        return self._local

    @property
    def main(self):
        return self._main

    def copy_temp_to_local(self, temp_name, local_name=None):
        if local_name is None:
            local_name = temp_name
        copyfile(
            self.temp.get_path(temp_name),
            self.local.get_path(local_name)
        )

    def copy_local_to_temp(self, local_name, temp_name=None):
        if temp_name is None:
            temp_name = local_name
        copyfile(
            self.local.get_path(local_name),
            self.temp.get_path(temp_name)
        )

    def copy_temp_to_main(self, temp_name, main_name=None):
        if main_name is None:
            main_name = temp_name
        if isinstance(self.main, LocalStorageArea):
            copyfile(
                self.temp.get_path(temp_name),
                self.main.get_path(main_name)
            )
        else:
            raise NotImplementedError("%s must implement copy_temp_to_main." %
                                      self.__class__.__name__)

    def copy_local_to_main(self, local_name, main_name=None):
        if main_name is None:
            main_name = local_name
        if isinstance(self.main, LocalStorageArea):
            copyfile(
                self.local.get_path(local_name),
                self.main.get_path(main_name)
            )
        else:
            raise NotImplementedError("%s must implement copy_local_to_main." %
                                      self.__class__.__name__)

    def copy_main_to_temp(self, main_name, temp_name=None):
        if temp_name is None:
            temp_name = main_name
        if isinstance(self.main, LocalStorageArea):
            copyfile(
                self.main.get_path(main_name),
                self.temp.get_path(temp_name)
            )
        else:
            raise NotImplementedError("%s must implement copy_main_to_temp." %
                                      self.__class__.__name__)

    def copy_main_to_local(self, main_name, local_name=None):
        if local_name is None:
            local_name = main_name
        if isinstance(self.main, LocalStorageArea):
            copyfile(
                self.main.get_path(main_name),
                self.local.get_path(local_name)
            )
        else:
            raise NotImplementedError("%s must implement copy_main_to_local." %
                                      self.__class__.__name__)

    def delete(self, path=""):
        self.temp.delete(path)
        self.local.delete(path)
        self.main.delete(path)

class InnerStorageArea:
    def __init__(self, area, path):
        self._area = area
        self._path = path

        if isinstance(area, LocalStorageArea):
            target = area.get_path(path)
            os.makedirs(target, exist_ok=True)

    def get_target_path(self, path):
        if path == "":
            return self._path
        return os.path.join(self._path, path)

    def get_path(self, path):
        return self._area.get_path(self.get_target_path(path))

    def get_stream(self, path):
        return self._area.get_stream(self.get_target_path(path))

    def get_url(self, path):
        return self._area.get_url(self.get_target_path(path))

    def delete(self, path=""):
        self._area.delete(self.get_target_path(path))
        if path == "" and isinstance(self._area, LocalStorageArea):
            target = self._area.get_path(self._path)
            os.makedirs(target, exist_ok=True)

class InnerFileStore(BaseFileStore):
    """Exposes a path inside an existing file store.

    To simplify creating file stores inside other file stores this store will
    append the given path to any API call.
    """
    def __init__(self, store, path):
        self._store = store
        self._path = path
        super().__init__(
            InnerStorageArea(store.temp, self._path),
            InnerStorageArea(store.local, self._path),
            InnerStorageArea(store.main, self._path),
        )

    def copy_temp_to_main(self, temp_name, main_name=None):
        if main_name is None:
            main_name = temp_name
        self._store.copy_temp_to_main(
            self.temp.get_target_path(temp_name),
            self.main.get_target_path(main_name),
        )

    def copy_local_to_main(self, local_name, main_name=None):
        if main_name is None:
            main_name = local_name
        self._store.copy_local_to_main(
            self.local.get_target_path(local_name),
            self.main.get_target_path(main_name),
        )

    def copy_main_to_temp(self, main_name, temp_name=None):
        if temp_name is None:
            temp_name = main_name
        self._store.copy_main_to_temp(
            self.main.get_target_path(main_name),
            self.temp.get_target_path(temp_name),
        )

    def copy_main_to_local(self, main_name, local_name=None):
        if local_name is None:
            local_name = main_name
        self._store.copy_main_to_local(
            self.main.get_target_path(main_name),
            self.local.get_target_path(local_name),
        )
