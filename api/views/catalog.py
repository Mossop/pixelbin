from django.db import transaction

from . import api_view
from ..serializers.catalog import CatalogCreateSerializer, CatalogSerializer

@api_view('PUT', request=CatalogCreateSerializer, response=CatalogSerializer)
@transaction.atomic
def create(request, deserialized):
    catalog = deserialized.save()
    catalog.users.add(request.user)

    request.user.had_catalog = True
    request.user.save()

    return catalog
