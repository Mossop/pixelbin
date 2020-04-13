from django.db import transaction

from . import ApiTestCase

class AlbumTests(ApiTestCase):
    def test_wrong_catalog(self):
        catalog1 = self.add_catalog('Test')
        catalog2 = self.add_catalog('Test2')

        album1 = catalog1.albums.create(name='Album1')
        self.assertEqual(album1.id[0], 'A')
        album2 = catalog2.albums.create(name='Album2')

        album2.parent = album1
        with self.assertRaisesApiException('catalog-mismatch'):
            album2.save()

    def test_no_cycles(self):
        catalog = self.add_catalog('Test')

        album1 = catalog.albums.create(name='Album1')
        album2 = catalog.albums.create(name='Album2', parent=album1)

        album1.parent = album2
        with self.assertRaisesApiException('cyclic-structure'):
            album1.save()

    def test_descendants(self):
        catalog = self.add_catalog('Test')

        toplevel1 = catalog.albums.create(name='toplevel1')
        toplevel2 = catalog.albums.create(name='toplevel2')
        level1_1 = catalog.albums.create(name='level1 1', parent=toplevel1)
        level1_2 = catalog.albums.create(name='level1 2', parent=toplevel1)
        level2 = catalog.albums.create(name='level2', parent=level1_1)

        desc = list(toplevel1.descendants())
        self.assertEqual(len(desc), 4)

        self.assertIn(toplevel1, desc)
        self.assertIn(level1_1, desc)
        self.assertIn(level1_2, desc)
        self.assertIn(level2, desc)

        self.assertNotIn(toplevel2, desc)

    def test_duplicate_name(self):
        catalog = self.add_catalog('Test')

        album1 = catalog.albums.create(name='Album')

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                catalog.albums.create(name='Album')

        album2 = catalog.albums.create(name='Album', parent=album1)

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                album2.parent = None
                album2.save()

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                catalog.albums.create(name='albuM', parent=album1)

    def test_request_create_album(self):
        user = self.create_user()
        catalog = self.add_catalog('Test', user)

        self.client.force_login(user)

        response = self.client.put('/api/album/create', content_type='application/json', data={
            'catalog': catalog.id,
            'name': 'Album1',
        })

        albums = list(catalog.albums.all())
        self.assertEqual(len(albums), 1)
        self.assertEqual(albums[0].name, 'Album1')

        data = response.json()
        self.assertEqual(data['id'], albums[0].id)
        self.assertEqual(data['name'], albums[0].name)
        self.assertEqual(data['catalog'], catalog.id)

    def test_request_edit_album(self):
        user = self.create_user()
        catalog = self.add_catalog('Test', user)
        catalog2 = self.add_catalog('Test2', user)
        album = catalog.albums.create(name='Album')
        album2 = catalog.albums.create(name='Album2', parent=album)
        album3 = catalog2.albums.create(name='Other')

        self.client.force_login(user)

        response = self.client.patch('/api/album/edit', content_type='application/json', data={
            'id': album.id,
            'name': 'NewName',
        })

        found_album = catalog.albums.get(id=album.id)
        self.assertEqual(found_album.name, 'NewName')

        data = response.json()
        self.assertEqual(data, {
            'id': album.id,
            'name': 'NewName',
            'stub': None,
            'catalog': catalog.id,
            'parent': None,
        })

        catalog2 = self.add_catalog('Test2', user)

        with self.assertRaisesApiException('catalog-change'):
            self.client.patch('/api/album/edit', content_type='application/json', data={
                'id': album.id,
                'catalog': catalog2.id,
            })

        with self.assertRaisesApiException('cyclic-structure'):
            self.client.patch('/api/album/edit', content_type='application/json', data={
                'id': album.id,
                'parent': album2.id,
            })

        with self.assertRaisesApiException('catalog-mismatch'):
            self.client.patch('/api/album/edit', content_type='application/json', data={
                'id': album.id,
                'parent': album3.id,
            })

    def test_request_invalid_access(self):
        user = self.create_user()
        catalog = self.add_catalog('Invisible')

        self.client.force_login(user)

        with self.assertRaisesApiException('not-found'):
            self.client.put('/api/album/create', content_type='application/json', data={
                'catalog': catalog.id,
                'name': 'Album1',
            })
