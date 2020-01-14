from rest_framework import serializers

from ..models import Catalog, Tag
from .import ModelSerializer, Serializer

class TagSerializer(ModelSerializer):
    class Meta:
        js_response_type = 'TagData'
        js_request_type = 'TagCreateData'
        model = Tag
        fields = ['id', 'catalog', 'parent', 'name']
        extra_kwargs = {
            'id': {'read_only': True},
        }

class TagFindSerializer(Serializer):
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())
    path = serializers.ListField(child=serializers.CharField(max_length=100), allow_empty=False)

    class Meta:
        js_request_type = 'TagLookup'
