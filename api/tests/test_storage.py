import os
import tempfile

from . import ApiTestCase, config_change
from ..storage.server import ServerFileStore
from ..storage.base import InnerFileStore

class StorageTests(ApiTestCase):
    def check_local_file(self, path):
        stream = open(path, 'rb')
        self.check_test_file(stream)

    def check_test_file(self, stream):
        self.assertIsNotNone(stream)
        data = b'\n'.join(stream.readlines())
        stream.close()
        self.assertEqual(data, b'Test file')

    def write_test_file(self, path):
        with open(path, 'w') as fp:
            fp.write('Test file')

    def check_area(self, area, root):
        self.assertTrue(os.path.isdir(root))
        path = area.get_path('foobar')
        self.assertEqual(path, os.path.join(root, 'foobar'))

        self.write_test_file(path)

        self.assertTrue(os.path.isfile(path))

        area.delete('foobar')
        self.assertFalse(os.path.isfile(path))

        self.write_test_file(path)

        self.assertTrue(os.path.isfile(path))

        area.delete()
        self.assertFalse(os.path.isfile(path))
        self.assertTrue(os.path.isdir(root))

        self.write_test_file(path)

        self.assertIsNone(area.get_url('foobar'))

        self.check_test_file(area.get_stream('foobar'))

        area.delete('fooba')
        area.delete('foobad')
        area.delete('foobaz')
        area.delete('foobarz')
        self.assertTrue(os.path.isfile(path))

        area.delete()
        self.assertTrue(os.path.isdir(root))

    def check_copy(self, source, target, do_copy, delete_source, delete_target):
        self.write_test_file(source)
        self.assertTrue(os.path.isfile(source))
        self.assertFalse(os.path.isfile(target))

        do_copy()
        self.assertTrue(os.path.isfile(source))
        self.check_local_file(source)
        self.assertTrue(os.path.isfile(target))
        self.check_local_file(target)

        delete_source()
        self.assertFalse(os.path.isfile(source))
        self.assertTrue(os.path.isfile(target))
        self.check_local_file(target)

        delete_target()
        self.assertFalse(os.path.isfile(source))
        self.assertFalse(os.path.isfile(target))

    def check_store(self, file_store, temp_root, local_root, main_root):
        self.check_area(file_store.temp, temp_root)
        self.check_area(file_store.local, local_root)
        self.check_area(file_store.main, main_root)

        self.check_copy(os.path.join(temp_root, 'foo'),
                        os.path.join(main_root, 'bar'),
                        lambda: file_store.copy_temp_to_main('foo', 'bar'),
                        file_store.temp.delete,
                        file_store.main.delete)

        self.check_copy(os.path.join(temp_root, 'foo'),
                        os.path.join(main_root, 'foo'),
                        lambda: file_store.copy_temp_to_main('foo'),
                        file_store.temp.delete,
                        file_store.main.delete)

        self.check_copy(os.path.join(local_root, 'foo'),
                        os.path.join(main_root, 'bar'),
                        lambda: file_store.copy_local_to_main('foo', 'bar'),
                        file_store.local.delete,
                        file_store.main.delete)

        self.check_copy(os.path.join(local_root, 'foo'),
                        os.path.join(main_root, 'foo'),
                        lambda: file_store.copy_local_to_main('foo'),
                        file_store.local.delete,
                        file_store.main.delete)

        file_store.delete()

    def test_server_storage(self):
        with tempfile.TemporaryDirectory() as temp_path:
            with config_change('path', 'data', temp_path):
                file_store = ServerFileStore()

                self.check_store(file_store,
                                 os.path.join(temp_path, 'storage', 'temp'),
                                 os.path.join(temp_path, 'storage', 'local'),
                                 os.path.join(temp_path, 'storage', 'main'))

    def test_inner_storage(self):
        with tempfile.TemporaryDirectory() as temp_path:
            with config_change('path', 'data', temp_path):
                file_store = ServerFileStore()
                inner_store = InnerFileStore(file_store, os.path.join('bar', 'baz'))

                self.check_store(inner_store,
                                 os.path.join(temp_path, 'storage', 'temp', 'bar', 'baz'),
                                 os.path.join(temp_path, 'storage', 'local', 'bar', 'baz'),
                                 os.path.join(temp_path, 'storage', 'main', 'bar', 'baz'))
