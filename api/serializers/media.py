from rest_framework import serializers

from ..models import Media, Person, Tag, Album, Catalog
from . import Serializer

class MediaSerializer(serializers.ModelSerializer):
    catalog = serializers.PrimaryKeyRelatedField(write_only=True, queryset=Catalog.objects.all())
    processVersion = serializers.IntegerField(source='process_version', read_only=True)

    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all())
    albums = serializers.PrimaryKeyRelatedField(many=True, queryset=Album.objects.all())
    people = serializers.PrimaryKeyRelatedField(many=True, queryset=Person.objects.all())

    class Meta:
        model = Media
        fields = ['id', 'catalog', 'processVersion', 'filename',
                  'tags', 'albums', 'people',
                  'title', 'taken', 'longitude', 'latitude',
                  'uploaded', 'mimetype', 'width', 'height', 'orientation']
        extra_kwargs = {
            'id': {'read_only': True},
            'filename': {'read_only': True},

            'uploaded': {'read_only': True},
            'mimetype': {'read_only': True},
            'width': {'read_only': True},
            'height': {'read_only': True},
        }

class ThumbnailRequestSerializer(Serializer):
    size = serializers.IntegerField()
