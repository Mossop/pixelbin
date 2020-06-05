import logging
from typing import Dict, Optional, Union

from django.utils.functional import SimpleLazyObject
from rest_framework.request import Request

from . import Serializer
from .user import UserSerializer
from ..models.user import User

LOGGER = logging.getLogger(__name__)

class ServerDataSerializer(Serializer):
    user = UserSerializer(allow_null=True)

    class Meta:
        js_response_type = 'ServerData'

def build_state(request: Request) -> Dict[str, Optional[Union[SimpleLazyObject, User]]]:
    if request.user.is_authenticated:
        return {"user": request.user}
    return {"user": None}

def serialize_state(request):
    serializer = ServerDataSerializer(build_state(request))
    return serializer.data
