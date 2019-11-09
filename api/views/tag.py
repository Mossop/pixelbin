from rest_framework.response import Response
from rest_framework import status

from ..models import Tag
from ..utils import api_view
from ..serializers.tag import TagSerializer, TagFindSerializer

@api_view(['PUT'])
def create(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = TagSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    catalog = serializer.validated_data['catalog']
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    parent = serializer.validated_data['parent']
    if parent is not None and catalog != parent.catalog:
        return Response(status=status.HTTP_400_BAD_REQUEST)

    name = serializer.validated_data['name']
    parent = serializer.validated_data['parent']
    with Tag.lock_for_create():
        tag = Tag.get_for_path(catalog, [name])

    serializer = TagSerializer(tag)
    return Response(serializer.data)

@api_view(['POST'])
def find(request):
    if not request.user or not request.user.is_authenticated:
        return Response(status=status.HTTP_403_FORBIDDEN)

    serializer = TagFindSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    catalog = serializer.validated_data['catalog']
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    with Tag.lock_for_create():
        tag = Tag.get_for_path(catalog, serializer.validated_data['path'])

    serializer = TagSerializer(tag)
    return Response(serializer.data)
