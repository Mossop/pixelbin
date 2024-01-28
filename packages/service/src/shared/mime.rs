use std::str::FromStr;

use diesel::{
    backend::Backend,
    deserialize::{self, FromSql},
    expression::AsExpression,
    serialize::{self, Output, ToSql},
    sql_types, Queryable,
};
use mime::{FromStrError, Mime};
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
    let st: &str = Deserialize::deserialize(deserializer)?;

    Mime::from_str(st)
        .map_err(|_| D::Error::invalid_value(Unexpected::Str(st), &"a valid mime type"))
}

#[derive(Debug, AsExpression)]
#[diesel(sql_type = sql_types::Text)]
pub(crate) struct MimeField(String);

impl From<Mime> for MimeField {
    fn from(mime: Mime) -> MimeField {
        MimeField(mime.to_string())
    }
}

impl From<&Mime> for MimeField {
    fn from(mime: &Mime) -> MimeField {
        MimeField(mime.to_string())
    }
}

impl<DB> ToSql<sql_types::Text, DB> for MimeField
where
    DB: Backend,
    String: ToSql<sql_types::Text, DB>,
{
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, DB>) -> serialize::Result {
        self.0.to_sql(out)
    }
}

impl TryInto<Mime> for MimeField {
    type Error = FromStrError;

    fn try_into(self) -> Result<Mime, Self::Error> {
        Mime::from_str(&self.0)
    }
}

impl<DB> Queryable<sql_types::Text, DB> for MimeField
where
    DB: Backend,
    String: FromSql<sql_types::Text, DB>,
{
    type Row = String;

    fn build(s: String) -> deserialize::Result<Self> {
        Ok(MimeField(s))
    }
}
