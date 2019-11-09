from django.db import transaction
from rest_framework.response import Response
from rest_framework import status

from ..models import Album, Access
from ..utils import uuid, api_view
from ..serializers.catalog import CatalogSerializer, BackblazeSerializer, ServerSerializer, \
    CatalogStateSerializer

@api_view(['PUT'])
def create(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    if 'storage' not in request.data or 'type' not in request.data['storage']:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    serializer = CatalogSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    name = serializer.validated_data['name']
    del serializer.validated_data['name']

    with transaction.atomic():
        if request.data['storage']['type'] == 'backblaze':
            storage_serializer = BackblazeSerializer(data=request.data['storage'])
            storage_serializer.is_valid(raise_exception=True)
            storage = storage_serializer.save()
            catalog = serializer.save(id=uuid('C'), backblaze=storage)
        elif request.data['storage']['type'] == 'server':
            storage_serializer = ServerSerializer(data=request.data['storage'])
            storage_serializer.is_valid(raise_exception=True)
            storage = storage_serializer.save()
            catalog = serializer.save(id=uuid('C'), server=storage)
        root = Album(id=uuid('A'), name=name, parent=None, catalog=catalog)
        root.save()

        access = Access(user=request.user, catalog=catalog)
        access.save()

        request.user.had_catalog = True
        request.user.save()

    serializer = CatalogStateSerializer(catalog)
    return Response(serializer.data)
