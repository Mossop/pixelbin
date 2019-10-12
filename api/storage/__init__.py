from django.db import models

class Storage(models.Model):
    def as_backblaze(self):
        try:
            return self.backblaze
        except:
            return None

    def as_server(self):
        try:
            return self.server
        except:
            return None

    def get_storage(self, media):
        if self.backblaze:
            return self.backblaze.get_storage(media)
        elif self.server:
            return self.server.get_storage(media)

class Server(Storage):
    type = 'server'

    def get_storage(self, media):
        from .server import ServerStorage
        return ServerStorage(media)

class Backblaze(Storage):
    type = 'backblaze'

    key_id = models.CharField(max_length=30)
    key = models.CharField(max_length=40)
    bucket = models.CharField(max_length=50)
    path = models.CharField(max_length=200)

    def get_storage(self, media):
        from .backblaze import BackblazeStorage
        return BackblazeStorage(media)
