use std::str::FromStr;

use mime::Mime;
use serde::{
    de::{Error, Unexpected},
    Deserialize, Deserializer, Serialize, Serializer,
};

pub(crate) fn serialize<S>(mime: &Mime, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    mime.as_ref().serialize(serializer)
}

pub(crate) fn deserialize<'de, D>(deserializer: D) -> Result<Mime, D::Error>
where
    D: Deserializer<'de>,
{
    let st: String = Deserialize::deserialize(deserializer)?;

    Mime::from_str(&st)
        .map_err(|_| D::Error::invalid_value(Unexpected::Str(&st), &"a valid mime type"))
}
