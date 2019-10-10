from . import models

from base64 import urlsafe_b64encode
from uuid import uuid4

def build_tags(catalog):
    tag_lists = { None: [] }
    for tag in models.Tag.objects.filter(catalog=catalog).order_by('name'):
        if tag.id not in tag_lists:
            tag_lists[tag.id] = []
        tag_parent = tag.parent.id if tag.parent is not None else None
        if tag_parent not in tag_lists:
            tag_lists[tag_parent] = []
        js = tag.asJS()
        js["children"] = tag_lists[tag.id]
        tag_lists[tag_parent].append(js)

    return tag_lists[None]

def build_albums(request):
    albums = { None: [] }
    for album in models.Album.objects.filter(catalog=catalog).order_by('name'):
        if album.id not in albums:
            albums[album.id] = []
        album_parent = album.parent.id if album.parent is not None else None
        if album_parent not in albums:
            albums[album_parent] = []
        js = album.asJS()
        js["children"] = albums[album.id]
        albums[album_parent].append(js)

    return albums[None]

def build_catalog(access):
    js = access.catalog.asJS()
    js["editable"] = access.editable and user.verified
    js["tags"] = build_tags(access.catalog)
    js["albums"] = build_albums(access.catalog)

    return js

def union(querysets):
    if len(querysets) == 0:
        return []
    first = querysets.pop(0)
    if len(querysets) == 0:
        return first
    return first.union(*querysets)

def uuid(start):
    return start + urlsafe_b64encode(uuid4().bytes).decode("utf-8")
