from rest_framework import serializers

from ..models import Media, Person, Tag, Album, Catalog
from . import Serializer

class MediaSerializer(serializers.ModelSerializer):
    catalog = serializers.PrimaryKeyRelatedField(write_only=True, queryset=Catalog.objects.all())

    processVersion = serializers.IntegerField(source='process_version', read_only=True)

    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all())
    albums = serializers.PrimaryKeyRelatedField(many=True, queryset=Album.objects.all())
    people = serializers.PrimaryKeyRelatedField(many=True, queryset=Person.objects.all())

    title = serializers.CharField(max_length=200, required=False, allow_null=True, allow_blank=True)
    taken = serializers.DateTimeField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    latitude = serializers.FloatField(required=False, allow_null=True)
    orientation = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Media
        fields = ['id', 'catalog', 'filename',
                  'processVersion', 'uploaded', 'mimetype', 'width', 'height',
                  'tags', 'albums', 'people',
                  'title', 'taken', 'longitude', 'latitude', 'orientation']
        extra_kwargs = {
            'id': {'read_only': True},
            'filename': {'read_only': True},

            'processVersion': {'read_only': True, 'source': 'process_version'},
            'uploaded': {'read_only': True},
            'mimetype': {'read_only': True},
            'width': {'read_only': True},
            'height': {'read_only': True},
        }

class ThumbnailRequestSerializer(Serializer):
    size = serializers.IntegerField()
