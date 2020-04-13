from ..models import User, Catalog

from . import ApiTestCase

class CatalogTests(ApiTestCase):
    def test_create_catalog(self):
        user = self.create_user()

        self.assertFalse(user.had_catalog)

        self.client.force_login(user)

        response = self.client.put('/api/catalog/create', content_type='application/json', data={
            'name': 'Catalog',
            'storage': {
                'type': 'server',
            },
        })

        data = response.json()

        self.assertIsInstance(data, dict)
        self.assertEqual(data['tags'], [])
        self.assertEqual(data['people'], [])
        self.assertEqual(data['albums'], [])
        self.assertEqual(data['name'], 'Catalog')
        self.assertEqual(data['id'][0], 'C')

        user = User.objects.get(id=user.id)
        self.assertTrue(user.had_catalog)

        catalog = Catalog.objects.get(id=data['id'])
        self.assertEqual(catalog.name, 'Catalog')

        user.check_can_see(catalog)
        user.check_can_modify(catalog)
