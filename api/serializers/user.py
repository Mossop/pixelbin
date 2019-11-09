from django.contrib.auth import get_user_model
from rest_framework import serializers

from ..models import User
from .catalog import CatalogStateSerializer
from . import Serializer

class LoginSerializer(Serializer):
    email = serializers.CharField()
    password = serializers.CharField()

class UserSerializer(serializers.ModelSerializer):
    fullname = serializers.CharField(source='full_name')
    password = serializers.CharField(write_only=True, allow_blank=True)
    hadCatalog = serializers.BooleanField(source='had_catalog', read_only=True)
    verified = serializers.BooleanField(read_only=True)

    def create(self, validated_data):
        user = get_user_model().objects.create_user(validated_data['email'],
                                                    validated_data['full_name'],
                                                    validated_data['password'])
        return user

    class Meta:
        model = User
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified']

class UserStateSerializer(UserSerializer):
    catalogs = CatalogStateSerializer(many=True)

    class Meta(UserSerializer.Meta):
        fields = ['email', 'password', 'fullname', 'hadCatalog', 'verified', 'catalogs']
