from django.urls import path

from .views import default, user, catalog, album, media, tag, person

urlpatterns = [
    path('login', user.login),
    path('logout', user.logout),
    path('user/create', user.create),

    path('catalog/create', catalog.create),

    path('album/create', album.create),
    path('album/edit/<ident>', album.edit),
    path('album/add_media/<ident>', album.add),
    path('album/remove_media/<ident>', album.remove),

    path('tag/create', tag.create),
    path('tag/find', tag.find),

    path('person/create', person.create),

    path('media/get/<ident>', media.get),
    path('media/create', media.create),
    path('media/upload/<ident>', media.upload),
    path('media/search', media.search),
    path('media/thumbnail/<ident>', media.thumbnail),

    path('', default),
]
