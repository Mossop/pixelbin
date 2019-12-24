from datetime import datetime

from django.db import models
from rest_framework import fields

METADATA_CACHE = dict()

def parse_exif_date(date):
    return datetime.strptime(date, '%Y:%m:%d %H:%M:%S')

def parse_exif_subsec_date(date):
    return datetime.strptime(date, '%Y:%m:%d %H:%M:%S.%f')

def parse_metadata(metadata, spec, default=None):
    for [key, parser] in spec:
        if key in metadata:
            return parser(metadata[key])
    return default

def straight(data):
    return data

def rotate(value):
    while value < 0:
        value += 360

    if value == 0:
        return 1
    if value == 90:
        return 6
    if value == 180:
        return 3
    if value == 270:
        return 8

class MediaMetadata:
    _media = None

    def __init__(self, media):
        self._media = media

    def __dir__(self):
        keys = [field.key for field in get_metadata_fields()]
        keys.extend([
            '_media',
            'get_media_value',
            'set_media_value',
            'serialize',
            'deserialize',
            'import',
        ])

    def __getattr__(self, key):
        field = get_metadata_field(key)
        if field is None:
            raise AttributeError('Metadata field %s does not exist.' % key)
        return field.get_value(self._media)

    def __setattr__(self, key, value):
        field = get_metadata_field(key)
        if field is None:
            self.__dict__[key] = value
            return
        field.set_override_value(self._media, value)

    def get_media_value(self, key):
        field = get_metadata_field(key)
        return field.get_media_value(self._media)

    def set_media_value(self, key, value):
        field = get_metadata_field(key)
        field.set_media_value(self._media, value)

    def serialize(self):
        return {field.key: field.serialize(self._media) for field in get_metadata_fields()}

    def deserialize(self, data):
        for key in data.keys():
            field = get_metadata_field(key)
            field.set_override_value(self._media, field.deserialize(data[key]))

    def import_from_media(self, metadata):
        for field in get_metadata_fields():
            field.import_from_media(self._media, metadata)

class MetadataField:
    type = None
    _key = None
    _default = None

    def __init__(self, key):
        self._key = key
        self._default = METADATA[key].get('default', None)
        METADATA_CACHE[key] = self

    @property
    def key(self):
        return self._key

    def should_import(self, media):
        if 'should_import' in METADATA[self.key]:
            return METADATA[self.key]['should_import'](media)
        return 'import_fields' in METADATA[self.key]

    def add_to_model(self, cls):
        cls.add_to_class('overridden_%s' % self._key, self.get_db_field())
        cls.add_to_class('media_%s' % self._key, self.get_db_field())

    def get_db_field(self):
        return models.CharField(max_length=200, null=True, blank=True)

    def add_to_serializer(self, cls):
        # pylint: disable=protected-access
        cls._declared_fields[self._key] = self.get_serializer_field()

    def get_serializer_field(self):
        return fields.CharField(max_length=200, allow_blank=True, required=False)

    def get_js_spec(self):
        spec = {
            'key': self.key,
            'type': self.type,
        }

        self.fill_js_spec(spec)
        return spec

    def fill_js_spec(self, spec):
        pass

    def get_value(self, media):
        value = getattr(media, 'overridden_%s' % self._key)
        if value is None:
            value = getattr(media, 'media_%s' % self._key)
        return value

    def get_override_value(self, media):
        return getattr(media, 'overridden_%s' % self._key)

    def set_override_value(self, media, value):
        setattr(media, 'overridden_%s' % self._key, value)

    def get_media_value(self, media):
        return getattr(media, 'media_%s' % self._key)

    def set_media_value(self, media, value):
        setattr(media, 'media_%s' % self._key, value)

    def serialize(self, media):
        self.serialize_value(self.get_value(media))

    def serialize_value(self, value):
        return value

    def deserialize(self, value):
        return value

    def import_from_media(self, media, metadata):
        if not self.should_import(media):
            return
        self.set_media_value(media,
                             parse_metadata(metadata,
                                            METADATA[self._key]['import_fields'], self._default))

    @classmethod
    def create(cls, key):
        field_type = METADATA[key]['type']
        for field_class in [StringMetadataField, IntegerMetadataField,
                            FloatMetadataField, DateTimeMetadataField]:
            if field_class.type == field_type:
                return field_class(key)
        raise Exception('Unknown metadata field type: %s' % field_type)

class StringMetadataField(MetadataField):
    type = 'string'
    max_length = None

    def __init__(self, key):
        super().__init__(key)
        if 'max_length' in METADATA[key]:
            self.max_length = METADATA[key]['max_length']
        else:
            self.max_length = 200

    def get_db_field(self):
        return models.CharField(max_length=self.max_length, null=True, blank=True)

    def get_serializer_field(self):
        return fields.CharField(max_length=self.max_length, allow_blank=True, required=False)

    def fill_js_spec(self, spec):
        spec['max_length'] = self.max_length

class FloatMetadataField(MetadataField):
    type = 'float'

    def get_db_field(self):
        return models.FloatField(null=True)

    def get_serializer_field(self):
        return fields.FloatField(required=False)

class IntegerMetadataField(MetadataField):
    type = 'integer'

    def get_db_field(self):
        return models.IntegerField(null=True)

    def get_serializer_field(self):
        return fields.IntegerField(required=False)

class DateTimeMetadataField(MetadataField):
    type = 'datetime'

    def get_db_field(self):
        return models.DateTimeField(null=True)

    def get_serializer_field(self):
        return fields.DateTimeField(required=False)

    def serialize_value(self, value):
        return value.isoformat()

METADATA = {
    'filename': {
        'type': 'string',
    },
    'title': {
        'type': 'string',
        'import_fields': [
            ['Title', straight],
        ],
    },
    'taken': {
        'type': 'datetime',
        'import_fields': [
            ['SubSecDateTimeOriginal', parse_exif_subsec_date],
            ['SubSecCreateDate', parse_exif_subsec_date],
            ['DateTimeOriginal', parse_exif_date],
            ['CreateDate', parse_exif_date],
            ['DateTimeCreated', parse_exif_date],
            ['DigitalCreationDateTime', parse_exif_date],
        ],
    },
    'longitude': {
        'type': 'float',
        'import_fields': [
            ['GPSLongitude', float],
        ],
    },
    'latitude': {
        'type': 'float',
        'import_fields': [
            ['GPSLatitude', float],
        ],
    },
    'orientation': {
        'type': 'integer',
        # Orientation is handled automatically for videos.
        'should_import': lambda media: not media.is_video,
        'import_fields': [
            ['Orientation', int],
            ['Rotation', rotate],
        ],
        'default': 1,
    }
}

def get_metadata_fields():
    return METADATA_CACHE.values()

def get_metadata_field(key):
    return METADATA_CACHE.get(key, None)

def get_js_spec():
    return [f.get_js_spec() for f in get_metadata_fields()]

def init():
    for key in METADATA:
        MetadataField.create(key)
init()
