from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import *

class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField()

class CatalogAlbumsSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = Album
        fields = ['id', 'stub', 'name', 'parent']

class CatalogTagsSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tag
        fields = ['id', 'name', 'parent']

class CatalogSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = Catalog
        fields = ['id', 'name']

class CatalogStateSerializer(CatalogSerializer):
    tags = CatalogTagsSerializer(many=True)
    albums = CatalogAlbumsSerializer(many=True)

    class Meta:
        model = Catalog
        fields = ['id', 'name', 'tags', 'albums']

class AccessSerializer(serializers.ModelSerializer):
    catalog = CatalogStateSerializer()

    class Meta:
        model = Access
        fields = ['catalog']

class UserSerializer(serializers.ModelSerializer):
    fullname = serializers.CharField(source='full_name')
    hadCatalog = serializers.BooleanField(source='had_catalog', read_only=True)
    verified = serializers.BooleanField(read_only=True)

    def create(self, validated_data):
        user = get_user_model().objects.create_user(validated_data['email'], validated_data['full_name'], validated_data['password'])
        user.save()
        return user

    class Meta:
        model = User
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified']
        extra_kwargs = {'password': {'write_only': True}}

class UserStateSerializer(UserSerializer):
    catalogs = AccessSerializer(many=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified', 'catalogs']
        extra_kwargs = {'password': {'write_only': True}}

class StateSerializer(serializers.Serializer):
    user = UserStateSerializer()

def serialize_state(request):
    if request.user.is_authenticated:
        return StateSerializer({ "user": request.user }).data
    else:
        return StateSerializer({ "user": None }).data
