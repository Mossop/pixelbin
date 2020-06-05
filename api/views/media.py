import os
import logging
from typing import Optional, Iterable

from django.db import transaction
from django.core.files.uploadedfile import UploadedFile
from django.http.response import HttpResponse
from filetype import filetype
from rest_framework import status
from rest_framework.request import Request

from . import api_view
from ..models import Media, Catalog
from ..utils import ApiException
from ..serializers.media import MediaSerializer, ThumbnailRequestSerializer
from ..serializers.search import SearchSerializer
from ..serializers.wrappers import (
    ListSerializerWrapper,
    ModelIdQuery,
    BlobSerializer,
    MultipartSerializerWrapper,
    PatchSerializerWrapper
)
from ..tasks import process_new_file
from ..media import build_thumbnail, ALLOWED_TYPES

LOGGER = logging.getLogger(__name__)

def perform_upload(media: Media, file: UploadedFile) -> Media:
    try:
        temp = media.file_store.temp.get_path('original')
        with open(temp, "wb") as output:
            for chunk in file.chunks():
                output.write(chunk)

        media.new_file = True
        media.save()
    except Exception as exc:
        media.file_store.temp.delete()
        raise exc

    target_name: Optional[str]
    if file.name is not None and len(file.name) > 0:
        target_name = os.path.basename(file.name)
    else:
        target_name = None
    process_new_file(media.id, target_name)

    return media

def validate(request: Request, file: Optional[UploadedFile], catalog: Catalog) -> None:
    request.user.check_can_modify(catalog)

    if file is not None:
        guessed_mimetype = filetype.guess_mime(file)
        if not guessed_mimetype in ALLOWED_TYPES:
            raise ApiException('unknown-type', message_args={
                'type': guessed_mimetype,
            })

@api_view('PUT', request=MultipartSerializerWrapper(MediaSerializer), response=MediaSerializer)
@transaction.atomic
def create(request: Request, deserialized) -> Media:
    data = deserialized.validated_data
    file = data.get('file', None)

    validate(request, file, data['catalog'])

    media: Media = deserialized.save()
    if file is not None:
        return perform_upload(media, file)
    return media

@api_view('GET', request=ModelIdQuery(Media), response=MediaSerializer)
def get(request: Request, media: Media) -> Media:
    request.user.check_can_see(media.catalog)

    return media

@api_view('PUT', request=MultipartSerializerWrapper(PatchSerializerWrapper(MediaSerializer)),
          response=MediaSerializer)
def update(request: Request, deserialized) -> Media:
    media: Media = deserialized.instance
    data = deserialized.validated_data
    file = data.get('file', None)

    if 'catalog' in data and data['catalog'] != media.catalog:
        raise ApiException('catalog-change')

    validate(request, file, media.catalog)

    with transaction.atomic():
        media = deserialized.save()

        if file is not None:
            return perform_upload(media, file)
        return media

@api_view('POST', request=SearchSerializer, response=ListSerializerWrapper(MediaSerializer))
def search(request: Request, deserialized) -> Iterable[Media]:
    search_params = deserialized.create(deserialized.validated_data)

    request.user.check_can_see(search_params.catalog)

    query = search_params.get_query()
    if query is not None:
        return Media.objects.filter(query).distinct()
    return []

@api_view('GET', request=ThumbnailRequestSerializer, response=BlobSerializer())
def thumbnail(request: Request, deserialized) -> HttpResponse:
    media: Media = deserialized.validated_data['media']
    request.user.check_can_see(media.catalog)

    if media.info is None:
        raise ApiException('not-found', status=status.HTTP_404_NOT_FOUND)

    image = build_thumbnail(media.file_store, deserialized.validated_data['size'])
    response = HttpResponse(content_type='image/jpeg')
    response.tell()
    image.save(response, 'jpeg', quality=90)

    return response
