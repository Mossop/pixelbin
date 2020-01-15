import logging

from . import Serializer
from .user import UserSerializer

LOGGER = logging.getLogger(__name__)

class ServerDataSerializer(Serializer):
    user = UserSerializer(allow_null=True)

    class Meta:
        js_response_type = 'ServerData'

def build_state(request):
    if request.user.is_authenticated:
        return {"user": request.user}
    return {"user": None}

def serialize_state(request):
    serializer = ServerDataSerializer(build_state(request))
    return serializer.data
