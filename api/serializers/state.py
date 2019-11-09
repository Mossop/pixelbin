from . import Serializer
from .user import UserStateSerializer

class StateSerializer(Serializer):
    user = UserStateSerializer()

def serialize_state(request):
    if request.user.is_authenticated:
        return StateSerializer({"user": request.user}).data
    return StateSerializer({"user": None}).data
