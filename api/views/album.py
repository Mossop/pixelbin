from rest_framework.response import Response
from rest_framework import status

from ..models import Album
from ..utils import uuid, api_view
from ..serializers.album import AlbumSerializer, ManyMediaSerializer

@api_view(['PUT'])
def create(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = AlbumSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    catalog = serializer.validated_data['catalog']
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    album = serializer.save(id=uuid("A"), catalog=catalog)

    serializer = AlbumSerializer(album)
    return Response(serializer.data)

@api_view(['PATCH'])
def edit(request, ident):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

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
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    try:
        album = Album.objects.get(id=ident)
        if not request.user.can_access_catalog(album.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)
    except Album.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = ManyMediaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    for media in serializer.validated_data:
        if media.catalog != data['album'].catalog:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    data['album'].media.add(*serializer.validated_data)
    return Response(status=status.HTTP_200_OK)

@api_view(['DELETE'])
def remove(request, ident):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    try:
        album = Album.objects.get(id=ident)
        if not request.user.can_access_catalog(album.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)
    except Album.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    serializer = ManyMediaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    data['album'].media.remove(*serializer.validated_data)
    return Response(status=status.HTTP_200_OK)
