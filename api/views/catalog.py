from django.db import transaction

from . import api_view
from ..models import Access
from ..utils import uuid
from ..serializers.catalog import CatalogCreateSerializer, CatalogSerializer

@api_view('PUT', request=CatalogCreateSerializer, response=CatalogSerializer)
@transaction.atomic
def create(request, deserialized):
    catalog = deserialized.save(id=uuid('C'))

    access = Access(user=request.user, catalog=catalog)
    access.save()

    request.user.had_catalog = True
    request.user.save()

    return catalog
