from django.contrib import admin
from .models import User, Catalog, Album, Tag, Media, Person
from .storage.models import Server, Backblaze

admin.site.register(User)
admin.site.register(Catalog)
admin.site.register(Album)
admin.site.register(Tag)
admin.site.register(Person)
admin.site.register(Media)

admin.site.register(Backblaze)
admin.site.register(Server)
