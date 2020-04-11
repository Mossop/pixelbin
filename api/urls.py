from django.urls import path

from .views import default, user, catalog, album, media, tag, person

urlpatterns = [
    path('state', user.state),

    path('login', user.login),
    path('logout', user.logout),
    path('user/create', user.create),

    path('catalog/create', catalog.create),

    path('album/create', album.create),
    path('album/edit', album.edit),
    path('album/add_media', album.add),
    path('album/remove_media', album.remove),

    path('tag/create', tag.create),
    path('tag/edit', tag.edit),
    path('tag/find', tag.find),

    path('person/create', person.create),

    path('media/get', media.get),
    path('media/create', media.create),
    path('media/update', media.update),
    path('media/search', media.search),
    path('media/thumbnail', media.thumbnail),

    path('', default),
]
