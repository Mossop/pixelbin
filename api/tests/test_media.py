from . import ApiTestCase

class MediaTests(ApiTestCase):
    def test_model(self):
        catalog1 = self.add_catalog()
        tag1 = catalog1.tags.create(name=self.random_thing())
        catalog2 = self.add_catalog()
        tag2 = catalog2.tags.create(name=self.random_thing())

        media = catalog1.media.create()

        self.assertEqual(media.metadata.filename, None)
        self.assertEqual(media.overridden_filename, None)
        self.assertEqual(media.media_filename, None)

        media.metadata.filename = 'foo'
        self.assertEqual(media.metadata.filename, 'foo')
        self.assertEqual(media.overridden_filename, 'foo')
        self.assertEqual(media.media_filename, None)

        media.tags.add(tag1)

        with self.assertRaisesApiException('catalog-mismatch'):
            media.tags.add(tag2)
