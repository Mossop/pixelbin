from django.contrib import admin
from .models import User

class UserAdmin(admin.ModelAdmin):
    fields = ['email', 'full_name', 'password']

admin.site.register(User, UserAdmin)
