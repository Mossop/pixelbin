from rest_framework import serializers

def creator(cls, data):
    serializer = cls(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.create(serializer.validated_data)

class Serializer(serializers.Serializer):
    def update(self, instance, validated_data):
        pass

    def create(self, validated_data):
        pass

class ListSerializer(serializers.ListSerializer):
    def update(self, instance, validated_data):
        pass

    def create(self, validated_data):
        pass
