from django.test import TestCase, Client

from ..models import Catalog, Tag
from ..storage.models import Server
from ..utils import uuid, ApiException

from . import create_user, add_catalog

class TagTests(TestCase):
    def test_build_tag_hierarchy(self):
        storage = Server()
        storage.save()
        catalog = Catalog(id=uuid('C'), name='Test', storage=storage)
        catalog.save()

        tags = Tag.objects.all()
        self.assertEqual(len(tags), 0)

        tag = Tag.get_for_path(catalog, ['toplevel'])
        self.assertEqual(tag.name, 'toplevel')
        self.assertEqual(tag.parent, None)
        self.assertEqual(tag.path, ['toplevel'])

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
        storage = Server()
        storage.save()
        catalog1 = Catalog(id=uuid('C'), name='Test', storage=storage)
        catalog1.save()

        catalog2 = Catalog(id=uuid('C'), name='Test2', storage=storage)
        catalog2.save()

        tag1 = Tag.get_for_path(catalog1, ['tag1'])
        tag2 = Tag.get_for_path(catalog2, ['tag2'])

        tag2.parent = tag1
        with self.assertRaises(ApiException) as assertion:
            tag2.save()

        self.assertEqual(assertion.exception.code, 'catalog-mismatch')

    def test_no_cycles(self):
        storage = Server()
        storage.save()
        catalog = Catalog(id=uuid('C'), name='Test', storage=storage)
        catalog.save()

        tag1 = Tag.get_for_path(catalog, ['tag1'])
        tag2 = Tag.get_for_path(catalog, ['tag2'])

        tag2.parent = tag1
        tag2.save()

        tag1.parent = tag2
        with self.assertRaises(ApiException) as assertion:
            tag1.save()

        self.assertEqual(assertion.exception.code, 'cyclic-structure')

    def test_duplicate_name_with_parent(self):
        storage = Server()
        storage.save()
        catalog = Catalog(id=uuid('C'), name='Test', storage=storage)
        catalog.save()

        tag1 = Tag.get_for_path(catalog, ['tag'])
        self.assertIsNone(tag1.parent)

        tag2 = Tag.get_for_path(catalog, ['parent', 'tag'])
        self.assertNotEqual(tag1, tag2)

        tag1.parent = tag2.parent
        with self.assertRaises(ApiException) as assertion:
            tag1.save()

        self.assertEqual(assertion.exception.code, 'invalid-name')

    def test_duplicate_name_without_parent(self):
        storage = Server()
        storage.save()
        catalog = Catalog(id=uuid('C'), name='Test', storage=storage)
        catalog.save()

        tag1 = Tag.get_for_path(catalog, ['tag'])
        self.assertIsNone(tag1.parent)

        tag2 = Tag.get_for_path(catalog, ['parent', 'tag'])
        self.assertNotEqual(tag1, tag2)

        tag2.parent = None
        with self.assertRaises(ApiException) as assertion:
            tag2.save()

        self.assertEqual(assertion.exception.code, 'invalid-name')

    def test_duplicate_different_case_name(self):
        storage = Server()
        storage.save()
        catalog = Catalog(id=uuid('C'), name='Test', storage=storage)
        catalog.save()

        tag1 = Tag.get_for_path(catalog, ['tag'])
        self.assertIsNone(tag1.parent)

        tag2 = Tag.get_for_path(catalog, ['parent', 'TaG'])
        self.assertNotEqual(tag1, tag2)

        tag2.parent = None
        with self.assertRaises(ApiException) as assertion:
            tag2.save()

        self.assertEqual(assertion.exception.code, 'invalid-name')

    def test_request_find_tag(self):
        user = create_user()
        catalog = add_catalog(user, 'Test')

        c = Client()
        c.force_login(user)

        response = c.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['toplevel'],
        })

        self.assertEqual(response.status_code, 200)

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

        response = c.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['toplevel'],
        })

        self.assertEqual(response.status_code, 200)

        data2 = response.json()

        self.assertEqual(data2, data)

        self.assertEqual(list(Tag.objects.all()), [tag])

        response = c.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['toplevel', 'sublevel'],
        })

        self.assertEqual(response.status_code, 200)

        data3 = response.json()

        self.assertEqual(data3[0], data[0])
        self.assertEqual(data3[1]['name'], 'sublevel')
        self.assertEqual(data3[1]['parent'], tag.id)
        self.assertEqual(data3[1]['catalog'], catalog.id)

        response = c.post('/api/tag/find', content_type='application/json', data={
            'catalog': catalog.id,
            'path': ['ToPleveL'],
        })

        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data[0]['id'], tag.id)

    def test_request_create_tag(self):
        user = create_user()
        catalog = add_catalog(user, 'Test')

        c = Client()
        c.force_login(user)

        response = c.put('/api/tag/create', content_type='application/json', data={
            'catalog': catalog.id,
            'parent': None,
            'name': 'toplevel',
        })

        self.assertEqual(response.status_code, 200)

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

        catalog2 = add_catalog(user, 'Test2')

        response2 = c.put('/api/tag/create', content_type='application/json', data={
            'catalog': catalog2.id,
            'parent': tag.id,
            'name': 'toplevel',
        })

        self.assertEqual(response2.status_code, 400)
        self.assertEqual(response2.json()['code'], 'catalog-mismatch')

    def test_request_edit_tag(self):
        user = create_user()
        catalog1 = add_catalog(user, 'Test')
        catalog2 = add_catalog(user, 'Test2')

        c = Client()
        c.force_login(user)

        tag1 = Tag(id=uuid('T'), catalog=catalog1, parent=None, name='tag1')
        tag1.save()

        tag2 = Tag(id=uuid('T'), catalog=catalog2, parent=None, name='tag2')
        tag2.save()

        tag3 = Tag(id=uuid('T'), catalog=catalog2, parent=None, name='tag3')
        tag3.save()

        response = c.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag1.id,
            'name': 'changed',
        })

        tag = Tag.objects.get(catalog=catalog1)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(tag.name, 'changed')

        response = c.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag1.id,
            'parent': tag2.id,
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'catalog-mismatch')

        response = c.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag1.id,
            'catalog': catalog2.id,
        })

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'catalog-change')

        response = c.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag3.id,
            'parent': tag2.id,
        })

        self.assertEqual(response.status_code, 200)

        tag2 = Tag.objects.get(name='tag2')
        tag3 = Tag.objects.get(name='tag3')

        self.assertEqual(tag3.parent, tag2)

        response = c.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag3.id,
            'parent': None,
        })

        self.assertEqual(response.status_code, 200)

        tag3 = Tag.objects.get(name='tag3')

        self.assertEqual(tag3.parent, None)

        response = c.patch('/api/tag/edit', content_type='application/json', data={
            'id': tag3.id,
            'name': 'Tag2',
        })

        self.assertEqual(response.status_code, 400)
