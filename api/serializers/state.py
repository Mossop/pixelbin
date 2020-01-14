import logging

from . import Serializer
from .user import UserSerializer

LOGGER = logging.getLogger(__name__)

class ServerDataSerializer(Serializer):
    user = UserSerializer(allow_null=True)

    class Meta:
        js_response_type = 'ServerData'

def serialize_state(request):
    state = {"user": None}
    if request.user.is_authenticated:
        state = {"user": request.user}

    serializer = ServerDataSerializer(state)
    return serializer.data
