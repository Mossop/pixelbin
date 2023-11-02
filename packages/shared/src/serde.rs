pub mod datetime {
    use serde::{Deserializer, Serialize, Serializer};
    use time::{
        format_description::well_known::{iso8601::Config, Iso8601},
        serde::rfc3339,
        OffsetDateTime,
    };

    const DATETIME_FORMAT: u128 = Config::DEFAULT.encode();

    pub fn serialize<S>(dt: &OffsetDateTime, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        dt.format(&Iso8601::<DATETIME_FORMAT>)
            .unwrap()
            .serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<OffsetDateTime, D::Error>
    where
        D: Deserializer<'de>,
    {
        rfc3339::deserialize(deserializer)
    }

    pub mod option {
        use super::*;

        pub fn serialize<S>(dt: &Option<OffsetDateTime>, serializer: S) -> Result<S::Ok, S::Error>
        where
            S: Serializer,
        {
            dt.map(|dt| dt.format(&Iso8601::<DATETIME_FORMAT>).unwrap())
                .serialize(serializer)
        }
    }
}

pub mod primitive_datetime {
    use serde::{Serialize, Serializer};
    use time::{
        format_description::well_known::{
            iso8601::{Config, FormattedComponents},
            Iso8601,
        },
        PrimitiveDateTime,
    };

    const DATETIME_FORMAT: u128 = Config::DEFAULT
        .set_formatted_components(FormattedComponents::DateTime)
        .encode();

    pub fn serialize<S>(dt: &PrimitiveDateTime, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        dt.format(&Iso8601::<DATETIME_FORMAT>)
            .unwrap()
            .serialize(serializer)
    }

    pub mod option {
        use super::*;

        pub fn serialize<S>(
            dt: &Option<PrimitiveDateTime>,
            serializer: S,
        ) -> Result<S::Ok, S::Error>
        where
            S: Serializer,
        {
            dt.map(|dt| dt.format(&Iso8601::<DATETIME_FORMAT>).unwrap())
                .serialize(serializer)
        }
    }
}
