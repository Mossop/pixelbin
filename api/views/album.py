from rest_framework.response import Response
from rest_framework import status

from . import api_view
from ..utils import uuid, ApiException
from ..serializers.album import AlbumSerializer, AlbumMediaSerializer
from ..serializers import PatchSerializerWrapper

@api_view('PUT', request=AlbumSerializer, response=AlbumSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    if not request.user.can_access_catalog(data['catalog']):
        return Response(status=status.HTTP_403_FORBIDDEN)

    if 'parent' in data and data['parent'] is not None and \
       data['catalog'] != data['parent'].catalog:
        raise ApiException('catalog-mismatch')

    return deserialized.save(id=uuid("A"))

@api_view('PATCH', request=PatchSerializerWrapper(AlbumSerializer), response=AlbumSerializer)
def edit(request, deserialized):
    album = deserialized.instance
    if not request.user.can_access_catalog(album.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    data = deserialized.validated_data
    if 'catalog' in data and data['catalog'] != album.catalog:
        raise ApiException('catalog-change')

    if 'parent' in data and data['parent'] is not None and data['parent'].catalog != album.catalog:
        raise ApiException('catalog-mismatch')

    return deserialized.save()

@api_view('PUT', request=AlbumMediaSerializer)
def add(request, deserialized):
    data = deserialized.validated_data
    album = data['id']
    if not request.user.can_access_catalog(album.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    for media in data['media']:
        if media.catalog != album.catalog:
            raise ApiException('catalog-mismatch')

    album.media.add(*data['media'])
    return Response(status=status.HTTP_200_OK)

@api_view('DELETE', request=AlbumMediaSerializer)
def remove(request, deserialized):
    data = deserialized.validated_data
    album = data['id']
    if not request.user.can_access_catalog(album.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    album.media.remove(*deserialized.validated_data['media'])
    return Response(status=status.HTTP_200_OK)
