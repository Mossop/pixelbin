from rest_framework.response import Response
from rest_framework import status

from ..models import Person
from ..utils import api_view
from ..serializers.person import PersonSerializer

@api_view(['PUT'])
def create(request):
    serializer = PersonSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    catalog = serializer.validated_data['catalog']
    if not request.user.can_access_catalog(catalog):
        return Response(status=status.HTTP_403_FORBIDDEN)

    fullname = serializer.validated_data['fullname']
    with Person.lock_for_create():
        person = Person.get_for_name(catalog, fullname)

    serializer = PersonSerializer(person)
    return Response(serializer.data)
