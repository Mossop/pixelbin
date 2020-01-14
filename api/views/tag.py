from rest_framework.response import Response
from rest_framework import status

from . import api_view
from ..models import Tag
from ..serializers.tag import TagSerializer, TagFindSerializer

@api_view('PUT', request=TagSerializer, response=TagSerializer)
def create(request, deserialized):
    catalog = deserialized.validated_data['catalog']
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    parent = deserialized.validated_data['parent']
    if parent is not None and catalog != parent.catalog:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    name = deserialized.validated_data['name']
    parent = deserialized.validated_data['parent']
    with Tag.lock_for_create():
        return Tag.get_for_path(catalog, [name])

@api_view('POST', request=TagFindSerializer, response=TagSerializer)
def find(request, deserialized):
    catalog = deserialized.validated_data['catalog']
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    with Tag.lock_for_create():
        return Tag.get_for_path(catalog, deserialized.validated_data['path'])
