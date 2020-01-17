from rest_framework import serializers

from . import ModelSerializer, Serializer, ListSerializer
from ..models import Album, Media

class AlbumSerializer(ModelSerializer):
    class Meta:
        js_response_type = 'AlbumData'
        js_request_type = 'AlbumCreateData'
        model = Album
        fields = ['id', 'catalog', 'stub', 'name', 'parent']
        extra_kwargs = {
            'id': {'read_only': True},
            'stub': {'required': False},
            'parent': {'required': False},
        }

class AlbumMediaSerializer(Serializer):
    id = serializers.PrimaryKeyRelatedField(queryset=Media.objects.all(),
                                            allow_null=False)
    media = ListSerializer(child=serializers.PrimaryKeyRelatedField(queryset=Media.objects.all()))

    class Meta:
        js_request_type = 'AlbumMedia'
