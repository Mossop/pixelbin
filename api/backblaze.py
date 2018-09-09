import requests

from base.utils import config

B2_AUTHORIZE_URL = 'https://api.backblazeb2.com/b2api/v1/b2_authorize_account'

class Backblaze(object):
    def __init__(self, key_id, key, bucket_id, bucket_name):
        self.key_id = key_id
        self.key = key
        self.bucket_id = bucket_id
        self.bucket_name = bucket_name
        self.authorize()

    def get_endpoint(self, version, method):
        return '%s/b2api/v%s/%s' % (self.api_url, version, method)

    def authorize(self):
        response = requests.get(B2_AUTHORIZE_URL, auth=(self.key_id, self.key))
        data = response.json()
        if response.status_code != 200:
            raise Exception('Unable to authenticate with B2: %s %s' % (response.status_code, data['code']))

        self.auth_token = data['authorizationToken']
        self.api_url = data['apiUrl']
        self.download_url = data['downloadUrl']

    def upload(self, path, sha1, file, content_type='application/octet-stream'):
        for i in range(5):
            url = self.get_endpoint(1, 'b2_get_upload_url')
            headers = {
                'Authorization': self.auth_token,
            }
            params = {
                'bucketId': self.bucket_id,
            }
            response = requests.post(url, headers=headers, json=params)
            data = response.json()

            if response.status_code == 401 and data['code'] == 'expired_auth_token':
                self.authorize()
                return self.upload(path, sha1, file, content_type)

            if response.status_code != 200:
                continue

            upload_url = data['uploadUrl']
            token = data['authorizationToken']

            headers = {
                'Authorization': token,
                'X-Bz-File-Name': path,
                'Content-Type': content_type,
                'X-Bz-Content-Sha1': sha1,
            }

            response = requests.post(upload_url, headers=headers, data=file)
            data = response.json()
            if response.status_code != 200:
                continue

            return data['fileId']

        raise Exception('Failed to upload file after five attempts.')

    def delete(self, path, id):
        url = self.get_endpoint(1, 'b2_delete_file_version')
        headers = {
            'Authorization': self.auth_token,
        }
        params = {
            'fileName': path,
            'fileId': id,
        }
        response = requests.post(url, headers=headers, json=params)
        data = response.json()

        if response.status_code == 401 and data['code'] == 'expired_auth_token':
            self.authorize()
            self.delete(path, id)
            return

        if response.status_code != 200:
            raise Exception('Failed to delete file: %s %s' % (response.status_code, data['code']))

    def get_download_url(self, path, duration = 3600):
        url = self.get_endpoint(1, 'b2_get_download_authorization')
        headers = {
            'Authorization': self.auth_token,
        }
        params = {
            'bucketId': self.bucket_id,
            'fileNamePrefix': path,
            'validDurationInSeconds': duration,
        }
        response = requests.post(url, headers=headers, json=params)
        data = response.json()

        if response.status_code == 401 and data['code'] == 'expired_auth_token':
            self.authorize()
            return self.get_download_url(path, duration)

        token = data['authorizationToken']

        return '%s/file/%s/%s?Authorization=%s' % (self.download_url, self.bucket_name, path, token)

backblaze = Backblaze(
    config.get('backblaze', 'key_id'),
    config.get('backblaze', 'key'),
    config.get('backblaze', 'bucket_id'),
    config.get('backblaze', 'bucket'),
)
