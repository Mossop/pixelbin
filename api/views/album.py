from rest_framework.response import Response
from rest_framework import status

from . import api_view
from ..models import Album
from ..utils import uuid
from ..serializers.album import AlbumSerializer, AlbumMediaSerializer
from ..serializers import PatchSerializerWrapper

@api_view('PUT', request=AlbumSerializer, response=AlbumSerializer)
def create(request, deserialized):
    parent = deserialized.validated_data['parent']
    if not request.user.can_access_catalog(parent.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    return deserialized.save(id=uuid("A"), catalog=parent.catalog, parent=parent)

@api_view('PATCH', request=PatchSerializerWrapper(AlbumSerializer), response=AlbumSerializer)
def edit(request, deserialized):
    album = deserialized.instance
    if not request.user.can_access_catalog(album.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    data = deserialized.validated_data
    target_catalog = album.catalog
    if 'catalog' in data:
        target_catalog = data['catalog']
        if not request.user.can_access_catalog(target_catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)

    parent_album = album.parent
    if 'parent' in data:
        parent_album = data['parent']

    # Cannot have a parent album with a different catalog.
    if parent_album is not None and parent_album.catalog != target_catalog:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    # Can only be the top-level album if it was already the top-level album
    # for the new catalog.
    if parent_album is None:
        if album.parent is not None or target_catalog != album.catalog:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    return deserialized.save()

@api_view('PUT', request=AlbumMediaSerializer)
def add(request, deserialized):
    try:
        album = Album.objects.get(id=deserialized.validated_data['id'])
        if not request.user.can_access_catalog(album.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)
    except Album.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    for media in deserialized.validated_data:
        if media.catalog != album.catalog:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    album.media.add(*deserialized.validated_data)
    return Response(status=status.HTTP_200_OK)

@api_view('DELETE', request=AlbumMediaSerializer)
def remove(request, deserialized):
    try:
        album = Album.objects.get(id=deserialized.validated_data['id'])
        if not request.user.can_access_catalog(album.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)
    except Album.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    album.media.remove(*deserialized.validated_data)
    return Response(status=status.HTTP_200_OK)
