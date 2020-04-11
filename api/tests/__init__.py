from ..models import User, Catalog
from ..utils import uuid
from ..storage.models import Server

def create_user():
    user = User.objects.create_user(email='dtownsend@oxymoronical.com',
                                    full_name='Dave Townsend',
                                    password='foobar')
    return user

def add_catalog(user, name):
    storage = Server()
    storage.save()

    catalog = Catalog(id=uuid('C'), name=name, storage=storage)
    catalog.save()
    catalog.users.add(user)
    return catalog
