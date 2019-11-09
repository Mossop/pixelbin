from rest_framework import serializers

from ..models import Catalog, Tag
from .import Serializer

class TagSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False, allow_blank=False, allow_null=False, default=None)
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())
    parent = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all())

    class Meta:
        model = Tag
        fields = ['id', 'catalog', 'parent', 'name']

class TagFindSerializer(Serializer):
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())
    path = serializers.ListField(child=serializers.CharField(max_length=100), allow_empty=False)
