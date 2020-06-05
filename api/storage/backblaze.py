import os
from typing import Optional, Dict

from b2sdk.v1 import InMemoryAccountInfo, B2Api, DownloadDestLocalFile
from b2sdk.file_version import FileVersionInfoFactory
from b2sdk.raw_simulator import RawSimulator

from base.config import PATHS

from .base import BaseFileStore, BaseStorageArea, FileStorageArea

class BackblazeStorageArea(BaseStorageArea):
    def __init__(self, b2_api: B2Api, bucket: str, path: str) -> None:
        self._b2_api = b2_api
        self._bucket = bucket
        self._path = path

    def get_target_path(self, path: str) -> str:
        if path == "":
            return self._path
        return os.path.join(self._path, path)

    def get_url(self, path: str) -> str:
        target = self.get_target_path(path)
        bucket = self._b2_api.get_bucket_by_name(self._bucket)
        token = bucket.get_download_authorization(target, 60)
        return "%s?Authorization=%s" % (bucket.get_download_url(target), token)

    # pylint: disable=bad-whitespace
    def delete(self, path: str="") -> None:
        target = self.get_target_path(path)
        bucket = self._b2_api.get_bucket_by_name(self._bucket)
        start_file_name = target
        start_file_id = None

        while start_file_name is not None:
            response = self._b2_api.session.list_file_versions(bucket.id_, start_file_name,
                                                               start_file_id, 100, target)
            for entry in response['files']:
                file_version_info = FileVersionInfoFactory.from_api_response(entry)
                if not file_version_info.file_name.startswith(target):
                    # We're past the files we care about
                    return
                bucket.delete_file_version(file_version_info.id_, file_version_info.file_name)

            start_file_name = response['nextFileName']
            start_file_id = response['nextFileId']

class BackblazeFileStore(BaseFileStore):
    """A file store that uses Backblaze B2 storage for the main storage area."""
    STORAGE_CACHE: Dict[str, "BackblazeFileStore"] = dict()

    @classmethod
    def build(cls, model):
        if model.id in cls.STORAGE_CACHE:
            return cls.STORAGE_CACHE[model.id]

        file_store = BackblazeFileStore(model.key_id, model.key, model.bucket, model.path)
        cls.STORAGE_CACHE[model.id] = file_store
        return file_store

    # pylint: disable=bad-whitespace
    def __init__(
            self,
            key_id: str,
            key: str,
            bucket: str,
            path: str,
            raw_api: Optional[RawSimulator]=None
    ) -> None:
        account_info = InMemoryAccountInfo()
        b2_api = B2Api(account_info=account_info, raw_api=raw_api)
        b2_api.authorize_account("production", key_id, key)
        self._b2_api = b2_api
        self._bucket = bucket
        self._path = path

        super().__init__(
            FileStorageArea(os.path.join(PATHS.get('data'), 'storage', 'temp')),
            FileStorageArea(os.path.join(PATHS.get('data'), 'storage', 'local')),
            BackblazeStorageArea(b2_api, bucket, path)
        )

    @property
    def main(self) -> BackblazeStorageArea:
        return super().main # type: ignore

    def copy_temp_to_main(self, temp_name: str, main_name: Optional[str]=None) -> None:
        if main_name is None:
            main_name = temp_name
        target = self.main.get_target_path(main_name)
        bucket = self._b2_api.get_bucket_by_name(self._bucket)
        bucket.upload_local_file(self.temp.get_path(temp_name), target)

    def copy_local_to_main(self, local_name: str, main_name: Optional[str]=None) -> None:
        if main_name is None:
            main_name = local_name
        target = self.main.get_target_path(main_name)
        bucket = self._b2_api.get_bucket_by_name(self._bucket)
        bucket.upload_local_file(self.local.get_path(local_name), target)

    def copy_main_to_temp(self, main_name: str, temp_name: Optional[str]=None) -> None:
        if temp_name is None:
            temp_name = main_name
        target = self.main.get_target_path(main_name)
        bucket = self._b2_api.get_bucket_by_name(self._bucket)
        bucket.download_file_by_name(target, DownloadDestLocalFile(self.temp.get_path(temp_name)))

    def copy_main_to_local(self, main_name: str, local_name: Optional[str]=None) -> None:
        if local_name is None:
            local_name = main_name
        target = self.main.get_target_path(main_name)
        bucket = self._b2_api.get_bucket_by_name(self._bucket)
        bucket.download_file_by_name(target, DownloadDestLocalFile(self.local.get_path(local_name)))
