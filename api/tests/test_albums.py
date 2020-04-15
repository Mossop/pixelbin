from django.db import transaction

from . import ApiTestCase

class AlbumTests(ApiTestCase):
    def test_wrong_catalog(self):
        catalog1 = self.add_catalog()
        catalog2 = self.add_catalog()

        album1 = catalog1.albums.create(name=self.random_thing())
        self.assertEqual(album1.id[0], 'A')
        album2 = catalog2.albums.create(name=self.random_thing())

        album2.parent = album1
        with self.assertRaisesApiException('catalog-mismatch'):
            album2.save()

    def test_no_cycles(self):
        catalog = self.add_catalog()

        album1 = catalog.albums.create(name=self.random_thing())
        album2 = catalog.albums.create(name=self.random_thing(), parent=album1)

        album1.parent = album2
        with self.assertRaisesApiException('cyclic-structure'):
            album1.save()

    def test_descendants(self):
        catalog = self.add_catalog()

        toplevel1 = catalog.albums.create(name=self.random_thing())
        toplevel2 = catalog.albums.create(name=self.random_thing())
        level1_1 = catalog.albums.create(name=self.random_thing(), parent=toplevel1)
        level1_2 = catalog.albums.create(name=self.random_thing(), parent=toplevel1)
        level2 = catalog.albums.create(name=self.random_thing(), parent=level1_1)

        desc = list(toplevel1.descendants())
        self.assertEqual(len(desc), 4)

        self.assertIn(toplevel1, desc)
        self.assertIn(level1_1, desc)
        self.assertIn(level1_2, desc)
        self.assertIn(level2, desc)

        self.assertNotIn(toplevel2, desc)

    def test_duplicate_name(self):
        catalog = self.add_catalog()

        name = self.random_thing()
        album1 = catalog.albums.create(name=name)

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                catalog.albums.create(name=name)

        album2 = catalog.albums.create(name=name, parent=album1)

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                album2.parent = None
                album2.save()

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                catalog.albums.create(name=self.amend_case(name), parent=album1)

    def test_request_create_album(self):
        user = self.create_user()
        catalog = self.add_catalog(user=user)

        self.client.force_login(user)

        name = self.random_thing()
        response = self.client.put('/api/album/create', data={
            'catalog': catalog.id,
            'name': name,
        })

        albums = list(catalog.albums.all())
        self.assertEqual(len(albums), 1)
        self.assertEqual(albums[0].name, name)

        data = response.json()
        self.assertEqual(data['id'], albums[0].id)
        self.assertEqual(data['name'], albums[0].name)
        self.assertEqual(data['catalog'], catalog.id)

    def test_request_edit_album(self):
        user = self.create_user()
        catalog = self.add_catalog(user=user)
        catalog2 = self.add_catalog(user=user)
        album = catalog.albums.create(name=self.random_thing())
        album2 = catalog.albums.create(name=self.random_thing(), parent=album)
        album3 = catalog2.albums.create(name=self.random_thing())

        self.client.force_login(user)

        newname = self.random_thing()
        response = self.client.patch('/api/album/edit', data={
            'id': album.id,
            'name': newname,
        })

        found_album = catalog.albums.get(id=album.id)
        self.assertEqual(found_album.name, newname)

        data = response.json()
        self.assertEqual(data, {
            'id': album.id,
            'name': newname,
            'stub': None,
            'catalog': catalog.id,
            'parent': None,
        })

        catalog2 = self.add_catalog(user=user)

        with self.assertRaisesApiException('catalog-change'):
            self.client.patch('/api/album/edit', data={
                'id': album.id,
                'catalog': catalog2.id,
            })

        with self.assertRaisesApiException('cyclic-structure'):
            self.client.patch('/api/album/edit', data={
                'id': album.id,
                'parent': album2.id,
            })

        with self.assertRaisesApiException('catalog-mismatch'):
            self.client.patch('/api/album/edit', data={
                'id': album.id,
                'parent': album3.id,
            })

    def test_request_invalid_access(self):
        user = self.create_user()
        catalog = self.add_catalog()

        self.client.force_login(user)

        with self.assertRaisesApiException('not-found'):
            self.client.put('/api/album/create', data={
                'catalog': catalog.id,
                'name': self.random_thing(),
            })
