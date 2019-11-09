import os

from django.http.response import HttpResponse
from django.db import transaction
from rest_framework.decorators import parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from filetype import filetype

from ..models import Media
from ..utils import uuid, api_view, ApiException
from ..serializers.media import MediaSerializer, ThumbnailRequestSerializer
from ..serializers.search import SearchSerializer
from ..tasks import process_media
from ..media import build_thumbnail

@api_view(['PUT'])
def create(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = MediaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    if not request.user.can_access_catalog(serializer.validated_data['catalog']):
        return Response(status=status.HTTP_403_FORBIDDEN)

    for album in serializer.validated_data['albums']:
        if album.catalog != serializer.validated_data['catalog']:
            return Response(status=status.HTTP_400_BAD_REQUEST)

    media = serializer.save(id=uuid('M'))
    serializer = MediaSerializer(media)
    return Response(serializer.data)

@api_view(['GET'])
def get(request, ident):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    try:
        media = Media.objects.get(id=ident)

        if not request.user.can_access_catalog(media.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = MediaSerializer(media)
        return Response(serializer.data)
    except Media.DoesNotExist:
        raise ApiException('unknown-media', status=status.HTTP_404_NOT_FOUND)

@api_view(['PUT'])
@parser_classes([MultiPartParser])
def upload(request, ident):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        try:
            media = Media.objects.select_for_update().get(id=ident)
        except Media.DoesNotExist:
            raise ApiException('unknown-media', status=status.HTTP_404_NOT_FOUND)

        if not request.user.can_access_catalog(media.catalog):
            return Response(status=status.HTTP_403_FORBIDDEN)

        file = request.data['file']
        filename = os.path.basename(file.name)
        if filename is None or filename == "":
            guessed = filetype.guess(file)
            filename = 'original.%s' % (guessed.extension)

        try:
            temp = media.storage.get_temp_path(filename)
            with open(temp, "wb") as output:
                for chunk in file.chunks():
                    output.write(chunk)

            media.filename = os.path.basename(file.name)
            media.storage_filename = filename
            media.save()

            process_media.delay(media.id)
        except Exception as exc:
            media.storage.delete_all_temp()
            raise exc

    serializer = MediaSerializer(media)
    return Response(serializer.data)

@api_view(['POST'])
def search(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = SearchSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    search_params = serializer.create(serializer.validated_data)

    if not request.user.can_access_catalog(search_params.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    query = search_params.get_query()
    media = []
    if query is not None:
        media = Media.objects.filter(query).distinct()
    serializer = MediaSerializer(media, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def thumbnail(request, ident):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    try:
        media = Media.objects.get(id=ident)
    except Media.DoesNotExist:
        raise ApiException('unknown-media', status=status.HTTP_404_NOT_FOUND)

    if not request.user.can_access_catalog(media.catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = ThumbnailRequestSerializer(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    size = serializer.validated_data['size']

    image = build_thumbnail(media, size)
    response = HttpResponse(content_type='image/jpeg')
    response.tell()
    image.save(response, 'jpeg', quality=90)

    return response
