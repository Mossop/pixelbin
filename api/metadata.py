from __future__ import annotations

from datetime import datetime, time
import re
from typing import (
    Mapping,
    Any,
    Callable,
    Dict,
    List,
    Type,
    Union,
    Optional,
    TypeVar,
    Generic,
    Tuple,
    TYPE_CHECKING
)

from django.db import models
from rest_framework import fields

from .media import is_video

if TYPE_CHECKING:
    from .models.media import Media
    from .serializers.media import MetadataSerializer

DATA_TO_ISO = re.compile(r'''^(\d+):(\d+):(\d+)''')

METADATA_FIELDS: Dict[str, MetadataField] = dict()

def into_iso(text: str) -> str:
    return DATA_TO_ISO.sub('\\1-\\2-\\3', text)

def parse_exif_time(text: str) -> time:
    return time.fromisoformat(text)

def parse_exif_datetime(text: str) -> datetime:
    return datetime.fromisoformat(into_iso(text))

def parse_exif_subsec_datetime(text: str) -> datetime:
    return datetime.strptime(text, '%Y:%m:%d %H:%M:%S.%f')

def parse_iso_datetime(text: str) -> datetime:
    return datetime.fromisoformat(text)

def parse_offset(date_str: str) -> Optional[int]:
    match = re.fullmatch(r"""([+-]?)(\d{1-2}):(\d{1-2})""", date_str)
    if match is not None:
        offset = int(match.group(2)) * 60 + int(match.group(3))
        if match.group(1) == '-':
            offset = -offset
        return offset
    return None

# pylint: disable=bad-whitespace
def parse_metadata(
        metadata: Dict[str, Any],
        spec: List[Union[str, Tuple[str, Callable]]],
        default: Optional[Any]=None
) -> Any:
    for import_spec in spec:
        key: str
        parser: Callable
        if isinstance(import_spec, tuple):
            [key, parser] = import_spec
        else:
            key = import_spec
            parser = lambda x: x

        if key in metadata:
            return parser(metadata[key])
    return default

def rotate(value: int) -> int:
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

    return value

class OrientationField(fields.IntegerField):
    def __init__(self, **kwargs) -> None:
        super().__init__(max_value=8, min_value=1, **kwargs)

class MediaMetadata:
    _media: Media

    def __init__(self, media: Media) -> None:
        self._media = media

    def __dir__(self) -> List[str]:
        keys = [field.key for field in get_metadata_fields()]
        keys.extend([
            '_media',
            'get_media_value',
            'set_media_value',
            'serialize',
            'deserialize',
            'import_from_media',
        ])
        return keys

    def __getattr__(self, key: str) -> Any:
        field = get_metadata_field(key)
        if field is None:
            raise AttributeError('Metadata field %s does not exist.' % key)
        return field.get_value(self._media)

    def __setattr__(self, key: str, value: Any) -> None:
        field = get_metadata_field(key)
        if field is None:
            self.__dict__[key] = value
            return
        field.set_override_value(self._media, value)

    def get_media_value(self, key: str) -> Any:
        field = get_metadata_field(key)
        if field is None:
            raise Exception("Unknown field %s accessed." % key)
        return field.get_media_value(self._media)

    def set_media_value(self, key: str, value: Any) -> None:
        field = get_metadata_field(key)
        if field is None:
            raise Exception("Unknown field %s accessed." % key)
        field.set_media_value(self._media, value)

    def serialize(self) -> Mapping[str, Any]:
        return {field.key: field.serialize(self._media) for field in get_metadata_fields()}

    def deserialize(self, data: Mapping[str, Any]) -> None:
        for key in data.keys():
            field = get_metadata_field(key)
            if field is None:
                continue
            field.set_override_value(self._media, field.deserialize(data[key]))

    def import_from_media(self, metadata: Mapping[str, Any]) -> None:
        for field in get_metadata_fields():
            field.import_from_media(self._media, metadata)

T = TypeVar('T')

class MetadataField(Generic[T]):
    _key: str
    _default: Optional[T]
    _js_name: str
    _should_import: Optional[Callable[[Media], bool]]
    _import_fields: Optional[List[Union[str, Tuple[str, Callable[[str], T]]]]]

    def __init__(
            self,
            key: str,
            default: Optional[T]=None,
            js_name: Optional[str]=None,
            should_import: Optional[Callable[[Media], bool]]=None,
            import_fields: Optional[List[Union[str, Tuple[str, Callable]]]]=None
    ) -> None:
        self._key = key
        self._default = default
        self._js_name = js_name if js_name is not None else key
        self._should_import = should_import
        self._import_fields = import_fields
        METADATA_FIELDS[key] = self

    @property
    def type(self) -> str:
        raise Exception("%s should implement type." % self.__class__.__name__)

    @property
    def key(self) -> str:
        return self._key

    @property
    def js_name(self) -> str:
        return self._js_name

    def should_import(self, media: Media) -> bool:
        if self._should_import is not None:
            return self._should_import(media)
        return True

    def add_to_model(self, cls: Type[Media]):
        cls.add_to_class('overridden_%s' % self._key, self.get_db_field()) # type: ignore
        cls.add_to_class('media_%s' % self._key, self.get_db_field()) # type: ignore

    def get_db_field(self) -> models.Field:
        return models.CharField(max_length=200, null=True, blank=True)

    def add_to_serializer(self, cls: Type[MetadataSerializer]) -> None:
        # pylint: disable=protected-access
        kwargs: Dict[str, Any] = dict()
        kwargs['required'] = False
        if self._js_name != self._key:
            kwargs['source'] = self._key
        kwargs['allow_null'] = True
        cls._declared_fields[self._js_name] = self.get_serializer_field(**kwargs)

    def get_serializer_field(self, **kwargs) -> fields.Field:
        return fields.CharField(max_length=200, allow_blank=True, **kwargs)

    def get_js_spec(self) -> Mapping[str, Any]:
        spec = {
            'key': self.js_name,
            'type': self.type,
        }

        self.fill_js_spec(spec)
        return spec

    def fill_js_spec(self, spec: Dict[str, Any]):
        pass

    def get_value(self, media: Media) -> Optional[T]:
        value = getattr(media, 'overridden_%s' % self._key)
        if value is None:
            value = getattr(media, 'media_%s' % self._key)
        return value

    def get_override_value(self, media: Media) -> Optional[T]:
        return getattr(media, 'overridden_%s' % self._key)

    def set_override_value(self, media: Media, value: Optional[T]) -> None:
        setattr(media, 'overridden_%s' % self._key, value)

    def get_media_value(self, media: Media) -> Optional[T]:
        return getattr(media, 'media_%s' % self._key)

    def set_media_value(self, media: Media, value: Optional[T]) -> None:
        setattr(media, 'media_%s' % self._key, value)

    def serialize(self, media: Media):
        return self.serialize_value(self.get_value(media))

    def serialize_value(self, value: Optional[T]):
        return value

    def deserialize(self, value: Optional[T]) -> Any:
        return value

    def import_from_media(self, media: Media, metadata: Dict[str, Any]) -> None:
        if not self.should_import(media):
            self.set_media_value(media, self._default)
            return

        if self._import_fields is None:
            raise Exception("No import fields for %s." % self.key)
        imported = parse_metadata(metadata, self._import_fields, self._default)
        self.set_media_value(media, imported)

class StringMetadataField(MetadataField[str]):
    type = 'string'
    max_length: int

    def __init__(self, *args, max_length: Optional[int]=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_length = max_length if max_length is not None else 200

    def get_db_field(self) -> models.Field:
        return models.CharField(max_length=self.max_length, null=True, blank=True)

    def get_serializer_field(self, **kwargs) -> fields.Field:
        return fields.CharField(max_length=self.max_length, allow_blank=True, **kwargs)

    def fill_js_spec(self, spec: Dict[str, Any]) -> None:
        spec['max_length'] = self.max_length

    def set_override_value(self, media: Media, value: Optional[str]) -> None:
        if value == '':
            value = None
        super().set_override_value(media, value)

class FloatMetadataField(MetadataField[float]):
    type = 'float'

    def get_db_field(self) -> models.Field:
        return models.FloatField(null=True)

    def get_serializer_field(self, **kwargs) -> fields.Field:
        return fields.FloatField(**kwargs)

class IntegerMetadataField(MetadataField[int]):
    type = 'integer'

    def get_db_field(self) -> models.Field:
        return models.IntegerField(null=True)

    def get_serializer_field(self, **kwargs) -> fields.Field:
        return fields.IntegerField(**kwargs)

class OrientationMetadataField(IntegerMetadataField):
    type = 'orientation'

    def __init__(self, key: str) -> None:
        super().__init__(key, import_fields=[
            ('Orientation', int),
            ('Rotation', rotate),
        ], default=1)

    def get_db_field(self) -> models.Field:
        return models.IntegerField(null=True)

    def get_serializer_field(self, **kwargs) -> fields.Field:
        return OrientationField(**kwargs)

    def should_import(self, media: Media) -> bool:
        return not is_video(media.info.mimetype)

class DateTimeMetadataField(MetadataField[datetime]):
    type = 'datetime'

    def get_db_field(self) -> models.Field:
        return models.DateTimeField(null=True)

    def get_serializer_field(self, **kwargs) -> fields.Field:
        return fields.DateTimeField(**kwargs)

    def serialize_value(self, value) -> str:
        return value.isoformat()

class TakenMetadataField(DateTimeMetadataField):
    def import_from_media(self, media: Media, metadata: Dict[str, Any]) -> None:
        taken = parse_metadata(metadata, [
            ('SubSecDateTimeOriginal', parse_exif_subsec_datetime),
            ('SubSecCreateDate', parse_exif_subsec_datetime),
        ])

        if taken is not None:
            self.set_media_value(media, taken)
            return

        taken = parse_metadata(metadata, [
            ('DateTimeOriginal', parse_exif_datetime),
            ('CreateDate', parse_exif_datetime),
            ('DateTimeCreated', parse_exif_datetime),
            ('DigitalCreationDateTime', parse_exif_datetime),
        ])

        if taken is None:
            taken = parse_metadata(metadata, [
                ('DigitalCreationDate', parse_exif_datetime),
            ])

            if taken is None:
                self.set_media_value(media, None)

            taken_time = parse_metadata(metadata, [
                ('DigitalCreationTime', parse_exif_time),
            ])

            if taken_time is not None:
                taken = datetime.combine(taken.date(), taken_time)

        subsec = parse_metadata(metadata, [
            'SubSecTimeOriginal',
            'SubSecTimeDigitized',
            'SubSecTime',
        ])

        if subsec is not None:
            subsec = float('0.%d' % subsec) * 1000000
            taken = taken.replace(microsecond=subsec)

        self.set_media_value(media, taken)

StringMetadataField('filename', import_fields=['FileName'])
StringMetadataField('title', import_fields=['Title'])
TakenMetadataField('taken')
IntegerMetadataField('offset', import_fields=[('OffsetTime', parse_offset)])
FloatMetadataField('longitude', import_fields=['GPSLongitude'])
FloatMetadataField('latitude', import_fields=['GPSLatitude'])
FloatMetadataField('altitude', import_fields=['GPSAltitude'])
StringMetadataField('location', import_fields=['Location', 'Sub-location'])
StringMetadataField('city', import_fields=['City'])
StringMetadataField('state', import_fields=['State', 'Province-State'])
StringMetadataField('country', import_fields=['Country', 'Country-PrimaryLocationName'])
OrientationMetadataField('orientation')
StringMetadataField('make', import_fields=['Make', 'ComAndroidManufacturer'])
StringMetadataField('model', import_fields=['Model', 'ComAndroidModel'])
StringMetadataField('lens', import_fields=['Lens', 'LensModel'])
StringMetadataField('photographer', import_fields=['Creator', 'Artist', 'By-line'])
FloatMetadataField('aperture', import_fields=['FNumber', 'ApertureValue'])
FloatMetadataField('exposure', import_fields=['ExposureTime', 'ShutterSpeed', 'ShutterSpeedValue'])
IntegerMetadataField('iso', import_fields=['ISO'])
FloatMetadataField('focal_length', js_name='focalLength', import_fields=['FocalLength'])
FloatMetadataField('bitrate', import_fields=['AvgBitrate'])

def get_metadata_fields():
    return METADATA_FIELDS.values()

def get_metadata_field(key: str) -> Optional[MetadataField]:
    return METADATA_FIELDS.get(key, None)

def get_js_spec():
    return [f.get_js_spec() for f in get_metadata_fields()]

def add_metadata_fields_to_model(model):
    for field in get_metadata_fields():
        field.add_to_model(model)
