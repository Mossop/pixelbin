from . import models

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

def build_state(request):
    if request.user.is_authenticated:
        return {
            "user": {
                "email": request.user.email,
                "fullname": request.user.full_name,
            },
            "tags": build_tags(request),
        }
    else:
        return {
            "user": None,
            "tags": None,
        }

def union(querysets):
    if len(querysets) == 0:
        return None
    first = querysets.pop(0)
    if len(querysets) == 0:
        return first
    return first.union(*querysets)
