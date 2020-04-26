import os
import tempfile

from b2sdk.raw_simulator import RawSimulator
from b2sdk.v1 import StubAccountInfo, B2Api

from . import ApiTestCase, config_change
from ..storage.server import ServerFileStore
from ..storage.base import InnerFileStore
from ..storage.backblaze import BackblazeFileStore

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

    def check_local_store(self, file_store, temp_root, local_root, main_root):
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

    def check_any_store(self, file_store):
        temp_path = file_store.temp.get_path('foo')
        local_path = file_store.local.get_path('foo')
        self.assertFalse(os.path.exists(temp_path))
        self.assertFalse(os.path.exists(local_path))

        self.write_test_file(temp_path)
        self.assertTrue(os.path.exists(temp_path))
        self.assertFalse(os.path.exists(local_path))

        self.check_test_file(file_store.temp.get_stream('foo'))
        self.check_local_file(temp_path)

        file_store.copy_temp_to_local('foo')
        self.assertTrue(os.path.exists(temp_path))
        self.assertTrue(os.path.exists(local_path))
        self.check_test_file(file_store.temp.get_stream('foo'))
        self.check_local_file(temp_path)
        self.check_test_file(file_store.local.get_stream('foo'))
        self.check_local_file(local_path)

        file_store.temp.delete('foo')
        self.assertFalse(os.path.exists(temp_path))
        self.assertTrue(os.path.exists(local_path))
        self.check_test_file(file_store.local.get_stream('foo'))
        self.check_local_file(local_path)

        file_store.copy_local_to_temp('foo')
        self.assertTrue(os.path.exists(temp_path))
        self.assertTrue(os.path.exists(local_path))
        self.check_test_file(file_store.temp.get_stream('foo'))
        self.check_local_file(temp_path)
        self.check_test_file(file_store.local.get_stream('foo'))
        self.check_local_file(local_path)

        file_store.local.delete('foo')
        self.assertTrue(os.path.exists(temp_path))
        self.assertFalse(os.path.exists(local_path))
        self.check_test_file(file_store.temp.get_stream('foo'))
        self.check_local_file(temp_path)

        file_store.copy_temp_to_main('foo')
        self.assertTrue(os.path.exists(temp_path))
        self.assertFalse(os.path.exists(local_path))
        self.check_test_file(file_store.temp.get_stream('foo'))
        self.check_local_file(temp_path)

        stream = file_store.main.get_stream('foo')
        if stream is not None:
            self.check_test_file(stream)
        else:
            self.assertIsNotNone(file_store.main.get_url('foo'))

        file_store.temp.delete('foo')
        self.assertFalse(os.path.exists(temp_path))
        self.assertFalse(os.path.exists(local_path))

        file_store.copy_main_to_temp('foo')
        self.assertTrue(os.path.exists(temp_path))
        self.assertFalse(os.path.exists(local_path))
        self.check_test_file(file_store.temp.get_stream('foo'))
        self.check_local_file(temp_path)

        file_store.copy_main_to_local('foo')
        self.assertTrue(os.path.exists(temp_path))
        self.assertTrue(os.path.exists(local_path))
        self.check_test_file(file_store.temp.get_stream('foo'))
        self.check_local_file(temp_path)
        self.check_test_file(file_store.local.get_stream('foo'))
        self.check_local_file(local_path)

        file_store.main.delete('foo')
        file_store.copy_local_to_main('foo', 'bar')

        stream = file_store.main.get_stream('bar')
        if stream is not None:
            self.check_test_file(stream)
        else:
            self.assertIsNotNone(file_store.main.get_url('bar'))

        file_store.copy_main_to_local('bar')
        temp_path = file_store.temp.get_path('bar')
        local_path = file_store.local.get_path('bar')
        self.assertFalse(os.path.exists(temp_path))
        self.assertTrue(os.path.exists(local_path))
        self.check_test_file(file_store.local.get_stream('bar'))
        self.check_local_file(local_path)

        file_store.main.delete('bar')

        self.assertRaises(Exception, lambda: file_store.copy_main_to_temp('foo'))
        self.assertRaises(Exception, lambda: file_store.copy_main_to_temp('bar'))

    def test_server_storage(self):
        with tempfile.TemporaryDirectory() as temp_path:
            with config_change('path', 'data', temp_path):
                file_store = ServerFileStore()

                self.check_local_store(file_store,
                                       os.path.join(temp_path, 'storage', 'temp'),
                                       os.path.join(temp_path, 'storage', 'local'),
                                       os.path.join(temp_path, 'storage', 'main'))
                self.check_any_store(file_store)

    def test_inner_storage(self):
        with tempfile.TemporaryDirectory() as temp_path:
            with config_change('path', 'data', temp_path):
                file_store = ServerFileStore()
                inner_store = InnerFileStore(file_store, os.path.join('bar', 'baz'))

                self.check_local_store(inner_store,
                                       os.path.join(temp_path, 'storage', 'temp', 'bar', 'baz'),
                                       os.path.join(temp_path, 'storage', 'local', 'bar', 'baz'),
                                       os.path.join(temp_path, 'storage', 'main', 'bar', 'baz'))
                self.check_any_store(inner_store)

    def test_backblaze_storage(self):
        with tempfile.TemporaryDirectory() as temp_path:
            with config_change('path', 'data', temp_path):
                account_info = StubAccountInfo()

                simulator = RawSimulator()
                (key_id, key) = simulator.create_account()

                test_api = B2Api(account_info, raw_api=simulator)
                test_api.authorize_account('production', key_id, key)
                test_api.create_bucket('test', 'allPublic')

                file_store = BackblazeFileStore(key_id, key, 'test', '', raw_api=simulator)
                self.check_any_store(file_store)
