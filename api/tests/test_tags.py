from django.test import TestCase
from django.db.utils import IntegrityError

from ..models import Catalog, Tag
from ..storage.models import Server
from ..utils import uuid, ApiException

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
        with self.assertRaises(IntegrityError):
            tag1.save()

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
        with self.assertRaises(IntegrityError):
            tag2.save()
