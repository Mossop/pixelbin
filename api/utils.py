from base64 import urlsafe_b64encode
from uuid import uuid4

def uuid(start):
    return start + urlsafe_b64encode(uuid4().bytes).decode("utf-8")
