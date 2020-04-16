from django.db import transaction

from . import api_view
from ..utils import ApiException
from ..models import Tag
from ..serializers.tag import TagSerializer, TagFindSerializer
from ..serializers.wrappers import ListSerializerWrapper, PatchSerializerWrapper

@api_view('PUT', request=TagSerializer, response=TagSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    with Tag.lock_for_create():
        with transaction.atomic():
            return deserialized.save()

@api_view('PATCH', request=PatchSerializerWrapper(TagSerializer), response=TagSerializer)
def edit(request, deserialized):
    tag = deserialized.instance
    request.user.check_can_modify(tag.catalog)

    data = deserialized.validated_data
    if 'catalog' in data and data['catalog'] != tag.catalog:
        raise ApiException('catalog-change')

    with transaction.atomic():
        return deserialized.save()

@api_view('POST', request=TagFindSerializer, response=ListSerializerWrapper(TagSerializer))
def find(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    with Tag.lock_for_create():
        with transaction.atomic():
            tag = Tag.get_for_path(data['catalog'], data['path'])

            # Build a list of all parents, top-level first.Any of these may have
            # been created when getting the tag.
            tags = []
            while tag is not None:
                tags.insert(0, tag)
                tag = tag.parent

            return tags
