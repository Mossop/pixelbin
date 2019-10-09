from django.contrib import admin
from .models import *
from .storage import *

admin.site.register(User)
admin.site.register(Catalog)
admin.site.register(Album)
admin.site.register(Tag)
admin.site.register(Media)

admin.site.register(Storage)
admin.site.register(Backblaze)
