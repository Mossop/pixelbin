from rest_framework.response import Response
from rest_framework import status

from ..models import Album
from ..utils import uuid, api_view
from ..serializers.album import AlbumSerializer, ManyMediaSerializer

@api_view(['PUT'])
def create(request):
    serializer = AlbumSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    parent = serializer.validated_data['parent']
    if not request.user.can_access_catalog(parent.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    album = serializer.save(id=uuid("A"), catalog=parent.catalog, parent=parent)

    serializer = AlbumSerializer(album)
    return Response(serializer.data)

@api_view(['PATCH'])
def edit(request, ident):
    try:
        album = Album.objects.get(id=ident)
        if not request.user.can_access_catalog(album.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)
    except Album.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = AlbumSerializer(album, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    if 'parent' in data and data['parent'].catalog != album.catalog:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    serializer.save()
    return Response(serializer.data)

@api_view(['PUT'])
def add(request, ident):
    try:
        album = Album.objects.get(id=ident)
        if not request.user.can_access_catalog(album.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)
    except Album.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = ManyMediaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    for media in serializer.validated_data:
        if media.catalog != album.catalog:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    album.media.add(*serializer.validated_data)
    return Response(status=status.HTTP_200_OK)

@api_view(['DELETE'])
def remove(request, ident):
    try:
        album = Album.objects.get(id=ident)
        if not request.user.can_access_catalog(album.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)
    except Album.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = ManyMediaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    album.media.remove(*serializer.validated_data)
    return Response(status=status.HTTP_200_OK)
