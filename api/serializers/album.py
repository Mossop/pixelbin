from rest_framework import serializers

from ..models import Album, Media
from . import ListSerializer

class AlbumSerializer(serializers.ModelSerializer):
    stub = serializers.CharField(allow_null=True, allow_blank=False, required=False, default=None)
    parent = serializers.PrimaryKeyRelatedField(queryset=Album.objects.all())

    class Meta:
        model = Album
        fields = ['id', 'stub', 'name', 'parent']
        extra_kwargs = {
            'id': {'read_only': True}
        }

class ManyMediaSerializer(ListSerializer):
    child = serializers.PrimaryKeyRelatedField(queryset=Media.objects.all())
