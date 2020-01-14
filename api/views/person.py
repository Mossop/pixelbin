from rest_framework.response import Response
from rest_framework import status

from . import api_view
from ..models import Person
from ..serializers.person import PersonSerializer

@api_view('PUT', request=PersonSerializer, response=PersonSerializer)
def create(request, deserialized):
    catalog = deserialized.validated_data['catalog']
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    fullname = deserialized.validated_data['fullname']
    with Person.lock_for_create():
        return Person.get_for_name(catalog, fullname)
