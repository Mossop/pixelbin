from ..models import User

from . import ApiTestCase

class UserTests(ApiTestCase):
    def test_create_user(self):
        response = self.client.put('/api/user/create', data={
            'email': 'dtownsend@oxymoronical.com',
            'password': 'mypass',
            'fullname': 'Dave Townsend',
        })

        data = response.json()
        self.assertEqual(data, {
            'user': {
                'email': 'dtownsend@oxymoronical.com',
                'fullname': 'Dave Townsend',
                'hadCatalog': False,
                'verified': False,
                'catalogs': [],
            },
        })

        created = User.objects.get(email='dtownsend@oxymoronical.com')
        self.assertEqual(created.full_name, 'Dave Townsend')

        logged_in = self.client.get_user()
        self.assertEqual(logged_in.email, 'dtownsend@oxymoronical.com')

        with self.assertRaisesApiException('validation-failure'):
            self.client.put('/api/user/create', data={
                'email': 'dtownsend@oxymoronical.com',
                'password': 'mypass',
                'fullname': 'Dave Townsend',
            })

        response = self.client.put('/api/user/create', data={
            'email': 'bob@oxymoronical.com',
            'password': 'otherpass',
            'fullname': 'Bob Townsend',
        })

        data = response.json()
        self.assertEqual(data, {
            'user': {
                'email': 'bob@oxymoronical.com',
                'fullname': 'Bob Townsend',
                'hadCatalog': False,
                'verified': False,
                'catalogs': [],
            },
        })

        logged_in = self.client.get_user()
        self.assertEqual(logged_in.email, 'bob@oxymoronical.com')

    def test_login(self):
        user = User.objects.create_user(email='dtownsend@oxymoronical.com',
                                        full_name='Dave Townsend',
                                        password='mypass')
        user.had_catalog = True
        user.verified = True
        user.save()

        response = self.client.post('/api/login', data={
            'email': 'dtownsend@oxymoronical.com',
            'password': 'mypass',
        })

        data = response.json()
        self.assertEqual(data, {
            'user': {
                'email': 'dtownsend@oxymoronical.com',
                'fullname': 'Dave Townsend',
                'hadCatalog': True,
                'verified': True,
                'catalogs': [],
            },
        })

        response = self.client.get('/api/state')

        data = response.json()
        self.assertEqual(data, {
            'user': {
                'email': 'dtownsend@oxymoronical.com',
                'fullname': 'Dave Townsend',
                'hadCatalog': True,
                'verified': True,
                'catalogs': [],
            },
        })

        logged_in = self.client.get_user()
        self.assertEqual(logged_in.email, 'dtownsend@oxymoronical.com')

        response = self.client.post('/api/logout')

        data = response.json()
        self.assertEqual(data, {
            'user': None,
        })

        logged_in = self.client.get_user()
        self.assertIsNone(logged_in)

        response = self.client.get('/api/state')

        data = response.json()
        self.assertEqual(data, {
            'user': None,
        })

        with self.assertRaisesApiException('login-failed'):
            self.client.post('/api/login', data={
                'email': 'dtownsend@oxymoronical.com',
                'password': 'foobar',
            })
