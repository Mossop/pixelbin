from django.db import transaction
from rest_framework.request import Request

from . import api_view
from ..models import Album
from ..utils import ApiException
from ..serializers.album import AlbumSerializer, AlbumMediaSerializer
from ..serializers.wrappers import PatchSerializerWrapper

@api_view('PUT', request=AlbumSerializer, response=AlbumSerializer)
def create(request: Request, deserialized) -> Album:
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    with transaction.atomic():
        return deserialized.save()

@api_view('PATCH', request=PatchSerializerWrapper(AlbumSerializer), response=AlbumSerializer)
def edit(request: Request, deserialized) -> Album:
    album: Album = deserialized.instance
    request.user.check_can_modify(album.catalog)

    data = deserialized.validated_data
    if 'catalog' in data and data['catalog'] != album.catalog:
        raise ApiException('catalog-change')

    with transaction.atomic():
        return deserialized.save()

@api_view('PUT', request=AlbumMediaSerializer, response=AlbumSerializer)
def add(request: Request, deserialized) -> Album:
    data = deserialized.validated_data
    album: Album = data['album']
    request.user.check_can_modify(album.catalog)

    with transaction.atomic():
        album.media.add(*data['media'])
        return album

@api_view('DELETE', request=AlbumMediaSerializer, response=AlbumSerializer)
def remove(request: Request, deserialized) -> Album:
    data = deserialized.validated_data
    album: Album = data['album']
    request.user.check_can_modify(album.catalog)

    with transaction.atomic():
        album.media.remove(*deserialized.validated_data['media'])
        return album
