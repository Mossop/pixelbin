from django.db import transaction

from . import api_view
from ..models import Catalog, Album, Access
from ..utils import uuid
from ..serializers.catalog import CatalogCreateSerializer, CatalogStateSerializer

@api_view('PUT', request=CatalogCreateSerializer, response=CatalogStateSerializer)
def create(request, deserialized):
    name = deserialized.validated_data['name']
    storage_serializer = deserialized.validated_data['storage']

    with transaction.atomic():
        storage = storage_serializer.save()
        catalog = Catalog(id=uuid('C'), storage=storage)
        catalog.save()
        root = Album(id=uuid('A'), name=name, parent=None, catalog=catalog)
        root.save()

        access = Access(user=request.user, catalog=catalog)
        access.save()

        request.user.had_catalog = True
        request.user.save()

    return catalog
