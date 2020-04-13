from django.db import transaction

from ..models import Tag

from . import ApiTestCase

class TagTests(ApiTestCase):
    def test_build_tag_hierarchy(self):
        catalog = self.add_catalog('Test')

        tags = Tag.objects.all()
        self.assertEqual(len(tags), 0)

        tag = Tag.get_for_path(catalog, ['toplevel'])
        self.assertEqual(tag.name, 'toplevel')
        self.assertEqual(tag.parent, None)
        self.assertEqual(tag.path, ['toplevel'])
        self.assertEqual(tag.id[0], 'T')

        subtag = Tag.get_for_path(catalog, ['toplevel', 'sublevel'])
        self.assertEqual(subtag.name, 'sublevel')
        self.assertEqual(subtag.parent, tag)
        self.assertEqual(subtag.path, ['toplevel', 'sublevel'])

        again = Tag.get_for_path(catalog, ['sublevel'])
        self.assertEqual(again, subtag)

        self.assertEqual(list(tag.descendants()), [tag, subtag])

        withpath1 = Tag.get_for_path(catalog, ['sublevel', 'new'], True)
        self.assertEqual(withpath1.parent, subtag)
        self.assertEqual(withpath1.path, ['toplevel', 'sublevel', 'new'])

        withpath2 = Tag.get_for_path(catalog, ['sublevel', 'new'], False)
        self.assertNotEqual(withpath2.parent, subtag)
        self.assertEqual(withpath2.path, ['sublevel', 'new'])

        # Should prefer to match tags with no parent.
        toplevel = Tag.get_for_path(catalog, ['sublevel'], True)
        self.assertEqual(toplevel, withpath2.parent)

    def test_wrong_catalog(self):
        catalog1 = self.add_catalog('Test')
        catalog2 = self.add_catalog('Test2')

        tag1 = Tag.get_for_path(catalog1, ['tag1'])
        tag2 = Tag.get_for_path(catalog2, ['tag2'])

        tag2.parent = tag1
        with self.assertRaisesApiException('catalog-mismatch'):
            tag2.save()

    def test_no_cycles(self):
        catalog = self.add_catalog('Test')

        tag1 = Tag.get_for_path(catalog, ['tag1'])
        tag2 = Tag.get_for_path(catalog, ['tag2'])

        tag2.parent = tag1
        tag2.save()

        tag1.parent = tag2
        with self.assertRaisesApiException('cyclic-structure'):
            tag1.save()

    def test_duplicate_name(self):
        catalog = self.add_catalog('Test')

        tag1 = catalog.tags.create(name='Tag')

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                catalog.tags.create(name='Tag')

        tag2 = catalog.tags.create(name='Tag', parent=tag1)
        tag2.parent = None

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                tag2.save()

        with transaction.atomic():
            with self.assertRaisesApiException('invalid-name'):
                catalog.tags.create(name='taG', parent=tag1)

    def test_request_find_tag(self):
        user = self.create_user()
        catalog = self.add_catalog('Test', user)

        self.client.force_login(user)

        response = self.client.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['toplevel'],
        })

        data = response.json()

        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['catalog'], catalog.id)
        self.assertEqual(data[0]['parent'], None)
        self.assertEqual(data[0]['name'], 'toplevel')

        tags = Tag.objects.all()
        self.assertEqual(len(tags), 1)

        tag = tags[0]
        self.assertEqual(tag.id, data[0]['id'])
        self.assertEqual(tag.name, 'toplevel')
        self.assertEqual(tag.catalog, catalog)
        self.assertEqual(tag.parent, None)

        response = self.client.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['toplevel'],
        })

        data2 = response.json()

        self.assertEqual(data2, data)

        self.assertEqual(list(Tag.objects.all()), [tag])

        response = self.client.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['toplevel', 'sublevel'],
        })

        data3 = response.json()

        self.assertEqual(data3[0], data[0])
        self.assertEqual(data3[1]['name'], 'sublevel')
        self.assertEqual(data3[1]['parent'], tag.id)
        self.assertEqual(data3[1]['catalog'], catalog.id)

        response = self.client.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['ToPleveL'],
        })

        data = response.json()
        self.assertEqual(data[0]['id'], tag.id)

    def test_request_create_tag(self):
        user = self.create_user()
        catalog = self.add_catalog('Test', user)

        self.client.force_login(user)

        response = self.client.put('/api/tag/create', content_type='application/json', data={
            'catalog': catalog.id,
            'parent': None,
            'name': 'toplevel',
        })

        data = response.json()

        self.assertIsInstance(data, dict)
        self.assertEqual(data['catalog'], catalog.id)
        self.assertEqual(data['parent'], None)
        self.assertEqual(data['name'], 'toplevel')

        tags = Tag.objects.all()
        self.assertEqual(len(tags), 1)

        tag = tags[0]
        self.assertEqual(tag.id, data['id'])
        self.assertEqual(tag.name, 'toplevel')
        self.assertEqual(tag.catalog, catalog)
        self.assertEqual(tag.parent, None)

        catalog2 = self.add_catalog('Test2', user)

        with self.assertRaisesApiException('catalog-mismatch'):
            self.client.put('/api/tag/create', content_type='application/json', data={
                'catalog': catalog2.id,
                'parent': tag.id,
                'name': 'toplevel',
            })

    def test_request_edit_tag(self):
        user = self.create_user()
        catalog1 = self.add_catalog('Test', user)
        catalog2 = self.add_catalog('Test2', user)

        self.client.force_login(user)

        tag1 = catalog1.tags.create(name='tag1')
        tag2 = catalog2.tags.create(name='tag2')
        tag3 = catalog2.tags.create(name='tag3')

        self.client.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag1.id,
            'name': 'changed',
        })

        tag = Tag.objects.get(catalog=catalog1)
        self.assertEqual(tag.name, 'changed')

        with self.assertRaisesApiException('catalog-mismatch'):
            self.client.patch('/api/tag/edit', content_type='application/json', data={
                'id': tag1.id,
                'parent': tag2.id,
            })

        with self.assertRaisesApiException('catalog-change'):
            self.client.patch('/api/tag/edit', content_type='application/json', data={
                'id': tag1.id,
                'catalog': catalog2.id,
            })

        self.client.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag3.id,
            'parent': tag2.id,
        })

        tag2 = Tag.objects.get(name='tag2')
        tag3 = Tag.objects.get(name='tag3')

        self.assertEqual(tag3.parent, tag2)

        self.client.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag3.id,
            'parent': None,
        })

        tag3 = Tag.objects.get(name='tag3')

        self.assertEqual(tag3.parent, None)

        with self.assertRaisesApiException('invalid-name'):
            self.client.patch('/api/tag/edit', content_type='application/json', data={
                'id': tag3.id,
                'name': 'Tag2',
            })

    def test_request_invalid_access(self):
        user = self.create_user()
        catalog = self.add_catalog('Invisible')

        self.client.force_login(user)

        with self.assertRaisesApiException('not-found'):
            self.client.put('/api/tag/create', content_type='application/json', data={
                'catalog': catalog.id,
                'name': 'Tag',
            })
