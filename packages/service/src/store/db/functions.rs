use std::str::FromStr;

use mime::Mime;
use sqlx::{Error as SqlxError, Result as SqlxResult};

pub(crate) fn from_mime(field: &str) -> SqlxResult<Mime> {
    Mime::from_str(field).map_err(|e| SqlxError::Decode(Box::new(e)))
}

macro_rules! from_row {
    (Catalog($row:ident)) => {
        crate::store::db::models::Catalog {
            id: $row.id,
            name: $row.name,
            storage: $row.storage,
        }
    };
    (Storage($row:ident)) => {
        crate::store::db::models::Storage {
            id: $row.id,
            name: $row.name,
            access_key_id: $row.access_key_id,
            secret_access_key: $row.secret_access_key,
            bucket: $row.bucket,
            region: $row.region,
            path: $row.path,
            endpoint: $row.endpoint,
            public_url: $row.public_url,
            _owner: $row.owner,
        }
    };
    (User($row:ident)) => {
        crate::store::db::models::User {
            email: $row.email,
            password: $row.password,
            fullname: $row.fullname,
            administrator: $row.administrator,
            created: $row.created,
            last_login: $row.last_login,
            verified: $row.verified,
        }
    };
    (Person($row:ident)) => {
        crate::store::db::models::Person {
            id: $row.id,
            name: $row.name,
            catalog: $row.catalog,
        }
    };
    (Tag($row:ident)) => {
        crate::store::db::models::Tag {
            id: $row.id,
            parent: $row.parent,
            name: $row.name,
            catalog: $row.catalog,
        }
    };
    (Album($row:ident)) => {
        crate::store::db::models::Album {
            id: $row.id,
            parent: $row.parent,
            name: $row.name,
            catalog: $row.catalog,
        }
    };
    (SavedSearch($row:ident)) => {
        crate::store::db::models::SavedSearch {
            id: $row.id,
            name: $row.name,
            shared: $row.shared,
            query: crate::shared::json::FromDb::decode($row.query)?,
            catalog: $row.catalog,
        }
    };
    (Relations($row:ident)) => {
        crate::store::db::models::Relations::decode(
            $row.albums,
            $row.tags,
            $row.people,
            $row.searches,
        )?
    };
    (MediaView($row:ident)) => {
        crate::store::db::models::MediaView {
            id: $row.id.unwrap(),
            catalog: $row.catalog.unwrap(),
            created: $row.created.unwrap(),
            datetime: $row.datetime.unwrap(),
            public: $row.public.unwrap(),
            metadata: crate::store::db::functions::from_row!(MediaMetadata($row)),
            taken_zone: $row.taken_zone,
            file: crate::store::db::models::MediaViewFile::from_maybe(
                $row.media_file,
                $row.file_size,
                $row.mimetype,
                $row.width,
                $row.height,
                $row.duration,
                $row.frame_rate,
                $row.bit_rate,
                $row.uploaded,
                $row.file_name,
                $row.alternates,
            )?,
        }
    };
    (MediaMetadata($row:ident)) => {
        crate::store::db::models::MediaMetadata {
            filename: $row.filename,
            title: $row.title,
            description: $row.description,
            label: $row.label,
            category: $row.category,
            location: $row.location,
            city: $row.city,
            state: $row.state,
            country: $row.country,
            make: $row.make,
            model: $row.model,
            lens: $row.lens,
            photographer: $row.photographer,
            shutter_speed: $row.shutter_speed,
            orientation: $row
                .orientation
                .and_then(crate::store::db::models::Orientation::from_repr),
            iso: $row.iso,
            rating: $row.rating,
            longitude: $row.longitude,
            latitude: $row.latitude,
            altitude: $row.altitude,
            aperture: $row.aperture,
            focal_length: $row.focal_length,
            taken: $row.taken,
        }
    };
    (MediaItem($row:ident)) => {
        crate::store::db::models::MediaItem {
            id: $row.id,
            deleted: $row.deleted,
            created: $row.created,
            metadata: crate::store::db::functions::from_row!(MediaMetadata($row)),
            taken_zone: $row.taken_zone,
            catalog: $row.catalog,
            media_file: $row.media_file,
            datetime: $row.datetime,
            public: $row.public,
        }
    };
    (AlternateFile($row:ident)) => {
        crate::store::db::models::AlternateFile {
            id: $row.id,
            file_type: crate::store::db::models::AlternateFileType::decode(&$row.r#type)?,
            file_name: $row.file_name,
            file_size: $row.file_size,
            mimetype: crate::store::db::functions::from_mime(&$row.mimetype)?,
            width: $row.width,
            height: $row.height,
            duration: $row.duration,
            frame_rate: $row.frame_rate,
            bit_rate: $row.bit_rate,
            media_file: $row.media_file,
            local: $row.local,
            stored: $row.stored,
            required: $row.required,
        }
    };
    (MediaFile($row:ident)) => {
        crate::store::db::models::MediaFile {
            id: $row.id.clone(),
            uploaded: $row.uploaded,
            file_name: $row.file_name.clone(),
            file_size: $row.file_size,
            mimetype: crate::store::db::functions::from_mime(&$row.mimetype)?,
            width: $row.width,
            height: $row.height,
            duration: $row.duration,
            frame_rate: $row.frame_rate,
            bit_rate: $row.bit_rate,
            media_item: $row.media_item.clone(),
            needs_metadata: $row.needs_metadata,
            stored: $row.stored,
            metadata: crate::store::db::functions::from_row!(MediaMetadata($row)),
        }
    };
    (MaybeMediaFile($row:ident)) => {
        crate::store::db::models::MediaFile::maybe(
            $row.media_file_id,
            $row.media_file_uploaded,
            $row.media_file_file_name,
            $row.media_file_file_size,
            $row.media_file_mimetype,
            $row.media_file_width,
            $row.media_file_height,
            $row.media_file_duration,
            $row.media_file_frame_rate,
            $row.media_file_bit_rate,
            $row.media_file_media_item,
            $row.media_file_needs_metadata,
            $row.media_file_stored,
            $row.media_file_filename,
            $row.media_file_title,
            $row.media_file_description,
            $row.media_file_label,
            $row.media_file_category,
            $row.media_file_location,
            $row.media_file_city,
            $row.media_file_state,
            $row.media_file_country,
            $row.media_file_make,
            $row.media_file_model,
            $row.media_file_lens,
            $row.media_file_photographer,
            $row.media_file_shutter_speed,
            $row.media_file_orientation,
            $row.media_file_iso,
            $row.media_file_rating,
            $row.media_file_longitude,
            $row.media_file_latitude,
            $row.media_file_altitude,
            $row.media_file_aperture,
            $row.media_file_focal_length,
            $row.media_file_taken,
        )?
    };
}

pub(crate) use from_row;
