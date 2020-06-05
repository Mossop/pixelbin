from django.db import transaction
from rest_framework.request import Request

from . import api_view
from ..models import Catalog
from ..serializers.catalog import CatalogCreateSerializer, CatalogSerializer

@api_view('PUT', request=CatalogCreateSerializer, response=CatalogSerializer)
@transaction.atomic
def create(request: Request, deserialized) -> Catalog:
    catalog: Catalog = deserialized.save()
    catalog.users.add(request.user)

    request.user.had_catalog = True
    request.user.save()

    return catalog
