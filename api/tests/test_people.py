from ..models import Person
from . import ApiTestCase

class PersonTests(ApiTestCase):
    def test_create(self):
        catalog = self.add_catalog()

        name = self.fake.name()
        person = Person.get_for_name(catalog, name)
        check = Person.get_for_name(catalog, self.amend_case(name))

        self.assertEqual(person, check)

        with self.assertRaisesApiException('invalid-name'):
            catalog.people.create(name=self.amend_case(name))

    def test_request_create(self):
        user = self.create_user()
        catalog = self.add_catalog(user=user)

        self.client.force_login(user)

        name = self.fake.name()
        response = self.client.put('/api/person/create', data={
            'catalog': catalog.id,
            'name': name,
        })

        data = response.json()
        person = list(catalog.people.all())[0]

        self.assertEqual(person.name, name)
        self.assertEqual(data, {
            'id': person.id,
            'name': name,
            'catalog': catalog.id,
        })

        response = self.client.put('/api/person/create', data={
            'catalog': catalog.id,
            'name': self.amend_case(name),
        })

        data = response.json()

        self.assertEqual(data, {
            'id': person.id,
            'name': name,
            'catalog': catalog.id,
        })
