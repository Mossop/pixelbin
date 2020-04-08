from django.test import TestCase
from base.utils import CONFIG, path

from ..models import Catalog, Tag
from ..storage.models import Server
from ..utils import uuid

CONFIG.read(path('test.ini'))

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
