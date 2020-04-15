from rest_framework import serializers

from ..models import Person
from . import ModelSerializer

class PersonSerializer(ModelSerializer):
    id = serializers.CharField(read_only=True, allow_blank=False, allow_null=False, default=None)

    class Meta:
        js_response_type = 'PersonData'
        js_request_type = 'PersonCreateData'
        model = Person
        fields = ['id', 'catalog', 'name']
