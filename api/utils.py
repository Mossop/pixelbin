from . import models

from base64 import urlsafe_b64encode
from uuid import uuid4

def build_tags(request):
    tagLists = { None: [] }
    for tag in models.Tag.objects.filter(owner=request.user).order_by('name'):
        if tag.id not in tagLists:
            tagLists[tag.id] = []
        tagParent = tag.parent.id if tag.parent is not None else None
        if tagParent not in tagLists:
            tagLists[tagParent] = []
        tagLists[tagParent].append({
            "id": tag.id,
            "name": tag.name,
            "path": tag.path,
            "children": tagLists[tag.id]
        })

    return tagLists[None]

def build_searches(request):
    searches = []
    for search in models.TagSearch.objects.filter(owner=request.user).order_by('name'):
        searches.append({
            'id': search.id,
            'name': search.name
        })
    return searches

def build_state(request):
    if request.user.is_authenticated:
        return {
            "user": {
                "email": request.user.email,
                "fullname": request.user.full_name,
            },
            "tags": build_tags(request),
            "searches": build_searches(request),
        }
    else:
        return {
            "user": None,
            "tags": None,
        }

def union(querysets):
    if len(querysets) == 0:
        return []
    first = querysets.pop(0)
    if len(querysets) == 0:
        return first
    return first.union(*querysets)

def uuid():
    return urlsafe_b64encode(uuid4().bytes)
