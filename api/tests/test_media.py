from django.db import transaction
from django.test.client import MULTIPART_CONTENT

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

    def test_get_media(self):
        user = self.create_user()
        catalog1 = self.add_catalog(user=user)
        media1 = catalog1.media.create()
        catalog2 = self.add_catalog()
        media2 = catalog2.media.create()

        media1.media_filename = 'bar'
        media1.save()

        self.client.force_login(user)

        response = self.client.get("/api/media/get", data={
            'id': media1.id,
        })
        data = response.json()

        self.assertEqual(data['id'], media1.id)
        self.assertEqual(data['metadata']['filename'], 'bar')

        with self.assertRaisesApiException('not-found'):
            self.client.get("/api/media/get", {
                'id': media2.id,
            })

    def test_edit_media(self):
        user = self.create_user()
        catalog1 = self.add_catalog(user=user)
        media1 = catalog1.media.create()

        media1.media_filename = 'bar'
        media1.save()

        self.client.force_login(user)

        response = self.client.put("/api/media/update", content_type=MULTIPART_CONTENT, data={
            'id': media1.id,
            'metadata.filename': 'foo',
        })
        data = response.json()

        media1 = media1.__class__.objects.get(id=media1.id)

        self.assertEqual(data['id'], media1.id)
        self.assertEqual(data['metadata']['filename'], 'foo')

        self.assertEqual(media1.metadata.filename, 'foo')
        self.assertEqual(media1.overridden_filename, 'foo')
        self.assertEqual(media1.media_filename, 'bar')
