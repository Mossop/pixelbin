import io

from django.db import transaction
from django.test.client import MULTIPART_CONTENT
from PIL import Image

from base.utils import path

from ..models import Media

from . import ApiTestCase

class MediaTests(ApiTestCase):
    def test_model(self):
        catalog1 = self.add_catalog()
        tag1 = catalog1.tags.create(name=self.random_thing())
        album1 = catalog1.albums.create(name=self.random_thing())
        person1 = catalog1.people.create(name=self.fake.name())
        catalog2 = self.add_catalog()

        media = catalog1.media.create()

        self.assertEqual(media.metadata.filename, None)
        self.assertEqual(media.overridden_filename, None)
        self.assertEqual(media.media_filename, None)

        media.metadata.filename = 'foo'
        self.assertEqual(media.metadata.filename, 'foo')
        self.assertEqual(media.overridden_filename, 'foo')
        self.assertEqual(media.media_filename, None)

        media.media_filename = 'bar'
        self.assertEqual(media.metadata.filename, 'foo')
        self.assertEqual(media.overridden_filename, 'foo')
        self.assertEqual(media.media_filename, 'bar')

        media.overridden_filename = None
        self.assertEqual(media.metadata.filename, 'bar')
        self.assertEqual(media.overridden_filename, None)
        self.assertEqual(media.media_filename, 'bar')

        media.tags.add(tag1)

        media = catalog2.media.create()

        with transaction.atomic():
            with self.assertRaisesApiException('catalog-mismatch'):
                media.tags.add(tag1)

        with transaction.atomic():
            with self.assertRaisesApiException('catalog-mismatch'):
                media.albums.add(album1)

        with transaction.atomic():
            with self.assertRaisesApiException('catalog-mismatch'):
                media.people.add(person1)

    def test_create_media(self):
        user = self.create_user()
        catalog = self.add_catalog(user=user)

        self.client.force_login(user)

        with open(path('api', 'tests', 'data', 'iptc.jpg'), mode='rb') as fp:
            response = self.client.put("/api/media/create", content_type=MULTIPART_CONTENT, data={
                'catalog': catalog.id,
                'file': fp,
            })

        self.assertEqual(response.json()['id'][0], 'M')

        media = Media.objects.get(id=response.json()['id'])
        self.assertEqual(media.catalog, catalog)

        response = self.client.get('/api/media/get/%s' % media.id)
        data = response.json()

        self.assertDictContains(data, {
            'id': media.id,
            'tags': [],
            'albums': [],
            'people': [],
            'metadata': {
                'filename': 'iptc.jpg',
                'title': 'The Title (ref2017.1)',
                'taken': '2017-07-13T10:01:00',
                'offset': None,
                'longitude': None,
                'latitude': None,
                'altitude': None,
                'location': 'Sublocation (Core) (ref2017.1)',
                'city': 'City (Core) (ref2017.1)',
                'state': 'Province/State (Core) (ref2017.1)',
                'country': 'Country (Core) (ref2017.1)',
                'orientation': 1,
                'make': None,
                'model': None,
                'lens': None,
                'photographer': "['Creator1 (ref2017.1)', 'Creator2 (ref2017.1)']",
                'aperture': None,
                'exposure': None,
                'iso': None,
                'focalLength': None,
                'bitrate': None
            }
        })

        self.assertDictContains(data['info'], {
            'processVersion': 1,
            'mimetype': 'image/jpeg',
            'width': 1000,
            'height': 500,
            'duration': None,
            'fileSize': 91435,
        })

        self.assertEqual(media.info.width, 1000)
        self.assertEqual(media.info.height, 500)
        self.assertEqual(media.info.file_size, 91435)
        self.assertEqual(media.metadata.filename, 'iptc.jpg')
        self.assertEqual(media.metadata.orientation, 1)

        with open(path('api', 'tests', 'data', 'iptc.jpg'), mode='rb') as fp:
            response = self.client.put("/api/media/create", content_type=MULTIPART_CONTENT, data={
                'catalog': catalog.id,
                'file': fp,
                'metadata.orientation': 2,
                'metadata.city': 'Portland'
            })

        self.assertEqual(response.json()['id'][0], 'M')

        media = Media.objects.get(id=response.json()['id'])
        self.assertEqual(media.catalog, catalog)

        self.assertEqual(media.metadata.orientation, 2)
        self.assertEqual(media.overridden_orientation, 2)
        self.assertEqual(media.media_orientation, 1)

        self.assertEqual(media.metadata.city, 'Portland')
        self.assertEqual(media.overridden_city, 'Portland')
        self.assertEqual(media.media_city, 'City (Core) (ref2017.1)')

        # Don't need to upload a file at all and supports JSON
        response = self.client.put("/api/media/create", data={
            'catalog': catalog.id,
            'metadata': {
                'city': 'Portland',
            },
        })

        media = Media.objects.get(id=response.json()['id'])
        self.assertEqual(media.catalog, catalog)
        self.assertEqual(media.metadata.city, 'Portland')

    def test_get_media(self):
        user = self.create_user()
        catalog1 = self.add_catalog(user=user)
        media1 = catalog1.media.create()
        catalog2 = self.add_catalog()
        media2 = catalog2.media.create()

        media1.media_filename = 'bar'
        media1.save()

        self.client.force_login(user)

        response = self.client.get('/api/media/get/%s' % media1.id)
        data = response.json()

        self.assertEqual(data['id'], media1.id)
        self.assertEqual(data['metadata']['filename'], 'bar')

        with self.assertRaisesApiException('not-found'):
            self.client.get('/api/media/get/%s' % media2.id)

    def test_edit_media(self):
        user = self.create_user()
        catalog1 = self.add_catalog(user=user)
        media1 = catalog1.media.create()
        catalog2 = self.add_catalog(user=user)

        media1.media_filename = 'bar'
        media1.save()

        self.client.force_login(user)

        response = self.client.put('/api/media/update/%s' % media1.id,
                                   content_type=MULTIPART_CONTENT, data={
                                       'metadata.filename': 'foo',
                                   })
        data = response.json()

        media1.refresh_from_db()

        self.assertEqual(data['id'], media1.id)
        self.assertEqual(data['metadata']['filename'], 'foo')

        self.assertEqual(media1.metadata.filename, 'foo')
        self.assertEqual(media1.overridden_filename, 'foo')
        self.assertEqual(media1.media_filename, 'bar')

        with self.assertRaisesApiException('catalog-change'):
            self.client.put('/api/media/update/%s' % media1.id,
                            content_type=MULTIPART_CONTENT, data={
                                'catalog': catalog2.id,
                            })

    def test_replace_media(self):
        user = self.create_user()
        catalog = self.add_catalog(user=user)

        self.client.force_login(user)

        with open(path('api', 'tests', 'data', 'iptc.jpg'), mode='rb') as fp:
            response = self.client.put("/api/media/create", content_type=MULTIPART_CONTENT, data={
                'catalog': catalog.id,
                'file': fp,
            })

        self.assertEqual(response.json()['id'][0], 'M')

        media = Media.objects.get(id=response.json()['id'])
        self.assertEqual(media.catalog, catalog)

        response = self.client.get('/api/media/get/%s' % media.id)

        data = response.json()
        self.assertEqual(data['id'], media.id)

        self.assertDictContains(data['info'], {
            'processVersion': 1,
            'mimetype': 'image/jpeg',
            'width': 1000,
            'height': 500,
            'fileSize': 91435,
        })

        self.assertDictContains(data['metadata'], {
            'city': 'City (Core) (ref2017.1)',
            'state': 'Province/State (Core) (ref2017.1)',
            'orientation': 1,
            'make': None,
            'model': None,
            'lens': None,
        })

        response = self.client.put('/api/media/update/%s' % media.id,
                                   content_type=MULTIPART_CONTENT, data={
                                       'metadata.city': 'Portland',
                                       'metadata.make': 'Canon',
                                   })
        data = response.json()

        self.assertDictContains(data['metadata'], {
            'city': 'Portland',
            'state': 'Province/State (Core) (ref2017.1)',
            'orientation': 1,
            'make': 'Canon',
            'model': None,
            'lens': None,
        })

        with open(path('api', 'tests', 'data', 'lamppost.jpg'), mode='rb') as fp:
            self.client.put('/api/media/update/%s' % media.id, content_type=MULTIPART_CONTENT,
                            data={
                                'file': fp,
                            })

        response = self.client.get('/api/media/get/%s' % media.id)
        data = response.json()

        self.assertEqual(data['id'], media.id)

        self.assertDictContains(data['info'], {
            'processVersion': 1,
            'mimetype': 'image/jpeg',
            'width': 500,
            'height': 331,
            'fileSize': 55084,
        })

        self.assertDictContains(data['metadata'], {
            'city': 'Portland',
            'state': 'Oregon',
            'orientation': 1,
            'make': 'Canon',
            'model': 'NIKON D7000',
            'lens': '18.0-200.0 mm f/3.5-5.6',
        })

        response = self.client.put('/api/media/update/%s' % media.id,
                                   content_type=MULTIPART_CONTENT, data={
                                       'metadata.make': '',
                                   })

        self.assertEqual(response.json()['metadata']['make'], 'NIKON CORPORATION')

    def test_thumbnail(self):
        user = self.create_user()
        catalog = self.add_catalog(user=user)

        self.client.force_login(user)

        with open(path('api', 'tests', 'data', 'lamppost.jpg'), mode='rb') as fp:
            response = self.client.put("/api/media/create", content_type=MULTIPART_CONTENT, data={
                'catalog': catalog.id,
                'file': fp,
            })

        media_id = response.json()['id']

        response = self.client.get('/api/media/thumbnail', data={
            'media': media_id,
            'size': 150,
        })

        self.assertEqual(response.get('Content-Type'), 'image/jpeg')
        fp = io.BytesIO(response.content)

        im = Image.open(fp)

        self.assertEqual(im.format, 'JPEG')
        self.assertThumbnailSizeCorrect(im, 150, 500, 331)

        response = self.client.get('/api/media/thumbnail', data={
            'media': media_id,
            'size': 170,
        })

        self.assertEqual(response.get('Content-Type'), 'image/jpeg')
        fp = io.BytesIO(response.content)

        im = Image.open(fp)

        self.assertEqual(im.format, 'JPEG')
        self.assertThumbnailSizeCorrect(im, 170, 500, 331)

        response = self.client.get('/api/media/thumbnail', data={
            'media': media_id,
            'size': 10,
        })

        self.assertEqual(response.get('Content-Type'), 'image/jpeg')
        fp = io.BytesIO(response.content)

        im = Image.open(fp)

        self.assertEqual(im.format, 'JPEG')
        self.assertThumbnailSizeCorrect(im, 10, 500, 331)
