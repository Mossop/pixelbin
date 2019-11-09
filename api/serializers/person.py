from rest_framework import serializers

from ..models import Catalog, Person

class PersonSerializer(serializers.ModelSerializer):
    id = serializers.CharField(required=False, allow_blank=False, allow_null=False, default=None)
    catalog = serializers.PrimaryKeyRelatedField(queryset=Catalog.objects.all())

    class Meta:
        model = Person
        fields = ['id', 'catalog', 'fullname']
