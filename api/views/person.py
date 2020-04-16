from django.db import transaction

from . import api_view
from ..models import Person
from ..serializers.person import PersonSerializer

@api_view('PUT', request=PersonSerializer, response=PersonSerializer)
def create(request, deserialized):
    data = deserialized.validated_data
    request.user.check_can_modify(data['catalog'])

    with Person.lock_for_create():
        with transaction.atomic():
            return Person.get_for_name(data['catalog'], data['name'])
