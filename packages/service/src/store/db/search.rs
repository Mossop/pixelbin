use serde::{Deserialize, Serialize};
use serde_plain::derive_display_from_serialize;
use sqlx::QueryBuilder;
use tracing::instrument;

use crate::store::{
    db::{DbConnection, SqlxDatabase},
    models::{MediaView, MediaViewSender},
};

pub(crate) type SearchQuery = CompoundQuery<CompoundItem>;

pub(crate) trait Filterable {
    fn bind_filter(&self, catalog: &str, builder: &mut QueryBuilder<SqlxDatabase>);
}

pub(crate) enum FieldType {
    Text,
    Float,
    Integer,
    Date,
    Reference,
}

pub(crate) trait Field {
    fn field_name(&self) -> String;
    fn field_type(&self) -> FieldType;

    fn push_field(&self, builder: &mut QueryBuilder<SqlxDatabase>) {
        builder.push(format!("\"{}\"", self.field_name()));
    }
}

pub(crate) trait RelationField: Field
where
    Self: Sized,
{
    fn bind_media_filter(
        catalog: &str,
        query: &RelationQuery<Self>,
        builder: &mut QueryBuilder<SqlxDatabase>,
    );
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub(crate) enum SqlValue {
    String(String),
    Bool(bool),
    Integer(i32),
    Double(f64),
}

impl SqlValue {
    fn bind_value(&self, builder: &mut QueryBuilder<SqlxDatabase>) {
        match self {
            SqlValue::String(v) => builder.push_bind(v.clone()),
            SqlValue::Bool(v) => builder.push_bind(*v),
            SqlValue::Integer(v) => builder.push_bind(*v),
            SqlValue::Double(v) => builder.push_bind(*v),
        };
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase", tag = "operator", content = "value")]
pub(crate) enum Operator {
    Empty,
    Equal(SqlValue),
    LessThan(SqlValue),
    #[serde(rename = "lessthanequal")]
    LessThanOrEqual(SqlValue),
    Contains(String),
    StartsWith(String),
    EndsWith(String),
    Matches(String),
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Modifier {
    Length,
    Year,
    Month,
    Day,
    DayOfWeek,
}

derive_display_from_serialize!(Modifier);

impl Modifier {
    fn bind_field<F: Field>(&self, field: &F, builder: &mut QueryBuilder<SqlxDatabase>) {
        match (field.field_type(), self) {
            (FieldType::Text, Self::Length) => {
                builder.push("CHAR_LENGTH(");
                field.push_field(builder);
                builder.push(")");
            }
            (FieldType::Date, Self::Year | Self::Month | Self::Day | Self::DayOfWeek) => {
                builder.push("EXTRACT(");
                match self {
                    Self::Year => builder.push("YEAR"),
                    Self::Month => builder.push("MONTH"),
                    Self::Day => builder.push("DAY"),
                    Self::DayOfWeek => builder.push("DOW"),
                    _ => unreachable!(),
                };
                builder.push("FROM TIMESTAMP ");
                field.push_field(builder);
                builder.push(")");
            }
            _ => field.push_field(builder),
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize, Clone, Copy)]
pub(crate) enum Join {
    #[default]
    #[serde(rename = "&&")]
    And,
    #[serde(rename = "||")]
    Or,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum MediaField {
    Title,
    Filename,
    Description,
    Category,
    Label,
    Location,
    City,
    State,
    Country,
    Make,
    Model,
    Lens,
    Photographer,
    ShutterSpeed,
    Longitude,
    Latitude,
    Altitude,
    Orientation,
    Aperture,
    Iso,
    FocalLength,
    Rating,
    Taken,
    TakenZone,
}

derive_display_from_serialize!(MediaField);

impl Field for MediaField {
    fn field_name(&self) -> String {
        match self {
            MediaField::ShutterSpeed => "shutter_speed".to_string(),
            MediaField::FocalLength => "focal_length".to_string(),
            MediaField::TakenZone => "taken_zone".to_string(),

            o => o.to_string(),
        }
    }

    fn field_type(&self) -> FieldType {
        match self {
            MediaField::ShutterSpeed
            | MediaField::Longitude
            | MediaField::Latitude
            | MediaField::Altitude
            | MediaField::Aperture
            | MediaField::FocalLength => FieldType::Float,
            MediaField::Orientation | MediaField::Iso | MediaField::Rating => FieldType::Integer,
            MediaField::Taken => FieldType::Date,

            _ => FieldType::Text,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TagField {
    Id,
    Name,
}

derive_display_from_serialize!(TagField);

impl Field for TagField {
    fn field_name(&self) -> String {
        self.to_string()
    }

    fn field_type(&self) -> FieldType {
        match self {
            Self::Id => FieldType::Reference,
            Self::Name => FieldType::Text,
        }
    }
}

impl RelationField for TagField {
    fn bind_media_filter(
        catalog: &str,
        query: &RelationQuery<TagField>,
        builder: &mut QueryBuilder<SqlxDatabase>,
    ) {
        builder.push(r#""media_view"."id" IN ("#);

        if query.recursive {
            builder.push(
                r#"
                SELECT "media_tag"."media"
                FROM "tag"
                    JOIN "tag_descendent" ON "tag_descendent"."id"="tag"."id"
                    JOIN "media_tag" ON "media_tag"."tag"="tag_descendent"."descendent"
                "#,
            );
        } else {
            builder.push(
                r#"
                SELECT "media_tag"."media"
                FROM "tag"
                    JOIN "media_tag" ON "media_tag"."tag"="tag"."id"
                "#,
            );
        }

        builder.push(r#"WHERE "tag"."catalog"="#);
        builder.push_bind(catalog.to_owned());
        builder.push(" AND ");
        query.query.bind_filter(catalog, builder);
        builder.push(")");
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PersonField {
    Id,
    Name,
}

derive_display_from_serialize!(PersonField);

impl Field for PersonField {
    fn field_name(&self) -> String {
        self.to_string()
    }

    fn field_type(&self) -> FieldType {
        match self {
            Self::Id => FieldType::Reference,
            Self::Name => FieldType::Text,
        }
    }
}

impl RelationField for PersonField {
    fn bind_media_filter(
        catalog: &str,
        query: &RelationQuery<PersonField>,
        builder: &mut QueryBuilder<SqlxDatabase>,
    ) {
        builder.push(r#""media_view"."id" IN ("#);

        builder.push(
            r#"
            SELECT "media_person"."media"
            FROM "person"
                JOIN "media_person" ON "media_person"."person"="person"."id"
            "#,
        );

        builder.push(r#"WHERE "person"."catalog"="#);
        builder.push_bind(catalog.to_owned());
        builder.push(" AND ");
        query.query.bind_filter(catalog, builder);
        builder.push(")");
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AlbumField {
    Id,
    Name,
}

derive_display_from_serialize!(AlbumField);

impl Field for AlbumField {
    fn field_name(&self) -> String {
        self.to_string()
    }

    fn field_type(&self) -> FieldType {
        match self {
            Self::Id => FieldType::Reference,
            Self::Name => FieldType::Text,
        }
    }
}

impl RelationField for AlbumField {
    fn bind_media_filter(
        catalog: &str,
        query: &RelationQuery<AlbumField>,
        builder: &mut QueryBuilder<SqlxDatabase>,
    ) {
        builder.push(r#""media_view"."id" IN ("#);

        if query.recursive {
            builder.push(
                r#"
                SELECT "media_album"."media"
                FROM "album"
                    JOIN "album_descendent" ON "album_descendent"."id"="album"."id"
                    JOIN "media_album" ON "media_album"."album"="album_descendent"."descendent"
                "#,
            );
        } else {
            builder.push(
                r#"
                SELECT "media_album"."media"
                FROM "album"
                    JOIN "media_album" ON "media_album"."album"="album"."id"
                "#,
            );
        }

        builder.push("WHERE album.catalog=");
        builder.push_bind(catalog.to_owned());
        builder.push(" AND ");
        query.query.bind_filter(catalog, builder);
        builder.push(")");
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FieldQuery<F> {
    #[serde(default, skip_serializing_if = "is_false")]
    pub(crate) invert: bool,
    pub(crate) field: F,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) modifier: Option<Modifier>,
    #[serde(flatten)]
    pub(crate) operator: Operator,
}

impl<F> FieldQuery<F>
where
    F: Field,
{
    fn push_field(&self, builder: &mut QueryBuilder<SqlxDatabase>) {
        if let Some(modifier) = self.modifier {
            modifier.bind_field(&self.field, builder);
        } else {
            self.field.push_field(builder);
        }
    }

    fn bind_query(&self, builder: &mut QueryBuilder<SqlxDatabase>) {
        match (&self.operator, self.invert) {
            (Operator::Empty, false) => {
                self.push_field(builder);
                builder.push(" IS NULL");
            }
            (Operator::Empty, true) => {
                self.push_field(builder);
                builder.push(" IS NOT NULL");
            }
            (Operator::Equal(v), false) => {
                self.push_field(builder);
                builder.push(" IS NOT DISTINCT FROM ");
                v.bind_value(builder);
            }
            (Operator::Equal(v), true) => {
                self.push_field(builder);
                builder.push(" IS DISTINCT FROM ");
                v.bind_value(builder);
            }
            (Operator::LessThan(v), false) => {
                self.push_field(builder);
                builder.push(" < ");
                v.bind_value(builder);
            }
            (Operator::LessThan(v), true) => {
                self.push_field(builder);
                builder.push(" >= ");
                v.bind_value(builder);
            }
            (Operator::LessThanOrEqual(v), false) => {
                self.push_field(builder);
                builder.push(" <= ");
                v.bind_value(builder);
            }
            (Operator::LessThanOrEqual(v), true) => {
                self.push_field(builder);
                builder.push(" > ");
                v.bind_value(builder);
            }
            (Operator::Contains(v), false) => {
                self.push_field(builder);
                builder.push(" LIKE '%' || ");
                builder.push_bind(v.clone());
                builder.push(" || '%'");
            }
            (Operator::Contains(v), true) => {
                builder.push("(");
                self.push_field(builder);
                builder.push(" IS NULL OR ");
                self.push_field(builder);
                builder.push(" NOT LIKE  '%' || ");
                builder.push_bind(v.clone());
                builder.push(" || '%')");
            }
            (Operator::StartsWith(v), false) => {
                self.push_field(builder);
                builder.push(" LIKE ");
                builder.push_bind(v.clone());
                builder.push(" || '%'");
            }
            (Operator::StartsWith(v), true) => {
                builder.push("(");
                self.push_field(builder);
                builder.push(" IS NULL OR ");
                self.push_field(builder);
                builder.push(" NOT LIKE ");
                builder.push_bind(v.clone());
                builder.push(" || '%')");
            }
            (Operator::EndsWith(v), false) => {
                self.push_field(builder);
                builder.push(" LIKE '%' || ");
                builder.push_bind(v.clone());
            }
            (Operator::EndsWith(v), true) => {
                builder.push("(");
                self.push_field(builder);
                builder.push(" IS NULL OR ");
                self.push_field(builder);
                builder.push(" NOT LIKE '%' || ");
                builder.push_bind(v.clone());
                builder.push(")");
            }
            (Operator::Matches(v), false) => {
                self.push_field(builder);
                builder.push(" ~ ");
                builder.push_bind(v.clone());
            }
            (Operator::Matches(v), true) => {
                builder.push("(");
                self.push_field(builder);
                builder.push(" IS NULL OR ");
                self.push_field(builder);
                builder.push(" !~ ");
                builder.push_bind(v.clone());
                builder.push(")");
            }
        }
    }
}

impl<F> Filterable for FieldQuery<F>
where
    F: Field,
{
    fn bind_filter(&self, _catalog: &str, builder: &mut QueryBuilder<SqlxDatabase>) {
        self.bind_query(builder);
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub(crate) enum RelationCompoundItem<F>
where
    F: Field,
{
    Field(FieldQuery<F>),
    Compound(CompoundQuery<Self>),
}

impl<F> Filterable for RelationCompoundItem<F>
where
    F: Field,
{
    fn bind_filter(&self, catalog: &str, builder: &mut QueryBuilder<SqlxDatabase>) {
        match self {
            RelationCompoundItem::Field(f) => f.bind_filter(catalog, builder),
            RelationCompoundItem::Compound(f) => f.bind_filter(catalog, builder),
        }
    }
}

fn is_false(val: &bool) -> bool {
    !val
}

fn is_and(join: &Join) -> bool {
    matches!(join, Join::And)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct RelationQuery<F>
where
    F: RelationField,
{
    #[serde(default, skip_serializing_if = "is_false")]
    recursive: bool,
    #[serde(flatten)]
    query: CompoundQuery<RelationCompoundItem<F>>,
}

impl<F> Filterable for RelationQuery<F>
where
    F: RelationField,
{
    fn bind_filter(&self, catalog: &str, builder: &mut QueryBuilder<SqlxDatabase>) {
        F::bind_media_filter(catalog, self, builder);
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "lowercase")]
pub(crate) enum CompoundItem {
    Field(FieldQuery<MediaField>),
    Tag(RelationQuery<TagField>),
    Person(RelationQuery<PersonField>),
    Album(RelationQuery<AlbumField>),
    Compound(CompoundQuery<Self>),
}

impl Filterable for CompoundItem {
    fn bind_filter(&self, catalog: &str, builder: &mut QueryBuilder<SqlxDatabase>) {
        match self {
            CompoundItem::Field(f) => f.bind_filter(catalog, builder),
            CompoundItem::Tag(f) => f.bind_filter(catalog, builder),
            CompoundItem::Person(f) => f.bind_filter(catalog, builder),
            CompoundItem::Album(f) => f.bind_filter(catalog, builder),
            CompoundItem::Compound(f) => f.bind_filter(catalog, builder),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct CompoundQuery<Q> {
    #[serde(default, skip_serializing_if = "is_false")]
    pub(crate) invert: bool,
    #[serde(default, skip_serializing_if = "is_and")]
    pub(crate) join: Join,
    pub(crate) queries: Vec<Q>,
}

impl<Q> Default for CompoundQuery<Q> {
    fn default() -> Self {
        Self {
            invert: Default::default(),
            join: Default::default(),
            queries: Default::default(),
        }
    }
}

impl CompoundQuery<CompoundItem> {
    #[instrument(skip_all)]
    pub(crate) async fn stream_media(
        self,
        mut conn: DbConnection<'static>,
        catalog: String,
        sender: MediaViewSender,
    ) {
        let mut builder =
            QueryBuilder::new(r#"SELECT "media_view".* FROM "media_view" WHERE "catalog"="#);
        builder.push_bind(&catalog);
        builder.push(" AND ");
        self.bind_filter(&catalog, &mut builder);
        builder.push(r#" ORDER BY "datetime" DESC"#);

        let stream = builder.build_query_as::<MediaView>().fetch(&mut conn);
        sender.send_stream(stream).await
    }
}

impl<Q> Filterable for CompoundQuery<Q>
where
    Q: Filterable,
{
    fn bind_filter(&self, catalog: &str, builder: &mut QueryBuilder<SqlxDatabase>) {
        if self.queries.is_empty() {
            if matches!(
                (self.invert, self.join),
                (false, Join::And) | (true, Join::Or)
            ) {
                builder.push("TRUE");
            } else {
                builder.push("FALSE");
            }
            return;
        }

        if self.invert {
            builder.push("NOT(");
        } else if self.queries.len() > 1 {
            builder.push("(");
        }

        self.queries[0].bind_filter(catalog, builder);

        for query in self.queries.iter().skip(1) {
            match self.join {
                Join::And => builder.push(" AND "),
                Join::Or => builder.push(" OR "),
            };

            query.bind_filter(catalog, builder);
        }

        if self.invert || self.queries.len() > 1 {
            builder.push(")");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::CompoundItem;

    fn attempt_parse(json: &str) {
        serde_json::from_str::<CompoundItem>(json).unwrap();
    }

    #[test]
    fn parsing() {
        attempt_parse(r#"{"invert":false,"type":"compound","join":"&&","queries":[]}"#);
        attempt_parse(r#"{"invert":true,"type":"compound","join":"||","queries":[]}"#);
        attempt_parse(
            r#"{
                "invert": false,
                "type": "compound",
                "join": "&&",
                "queries": [
                    {
                    "invert": false,
                    "type": "person",
                    "join": "||",
                    "queries": [
                        {
                            "invert": false,
                            "type": "field",
                            "field": "id",
                            "modifier": null,
                            "operator": "equal",
                            "value": "P:JDkiNRe5vR"
                        },
                        {
                            "invert": false,
                            "type": "field",
                            "field": "id",
                            "modifier": null,
                            "operator": "equal",
                            "value": "P:i9hZrZVwPP"
                        }
                    ],
                    "recursive": false
                    }
                ]
            }"#,
        );
        attempt_parse(
            r#"{
                "invert": false,
                "type": "compound",
                "join": "&&",
                "queries": [
                    {
                    "invert": false,
                    "type": "person",
                    "join": "||",
                    "queries": [
                        {
                            "invert": false,
                            "type": "field",
                            "field": "id",
                            "modifier": null,
                            "operator": "equal",
                            "value": "P:JDkiNRe5vR"
                        },
                        {
                            "invert": false,
                            "type": "field",
                            "field": "id",
                            "modifier": null,
                            "operator": "equal",
                            "value": "P:i9hZrZVwPP"
                        },
                        {
                            "invert": false,
                            "type": "field",
                            "field": "id",
                            "modifier": null,
                            "operator": "equal",
                            "value": "P:74GYRgwkjS"
                        },
                        {
                            "invert": false,
                            "type": "field",
                            "field": "id",
                            "modifier": null,
                            "operator": "equal",
                            "value": "P:JUUyyvwyBN"
                        }
                    ],
                    "recursive": true
                    }
                ]
            }"#,
        );
        attempt_parse(
            r#"{
                "invert": false,
                "type": "person",
                "join": "&&",
                "queries": [
                    {
                        "invert": false,
                        "type": "field",
                        "field": "id",
                        "modifier": null,
                        "operator": "equal",
                        "value": "P:JUUyyvwyBN"
                    }
                ],
                "recursive": false
            }"#,
        );
        attempt_parse(
            r#"{
                "invert": false,
                "type": "compound",
                "join": "&&",
                "queries": [
                    {
                    "invert": false,
                    "type": "tag",
                    "join": "||",
                    "queries": [
                        {
                        "invert": false,
                        "type": "field",
                        "field": "name",
                        "modifier": null,
                        "operator": "equal",
                        "value": "Loki"
                        },
                        {
                        "invert": false,
                        "type": "field",
                        "field": "name",
                        "modifier": null,
                        "operator": "equal",
                        "value": "Ripley"
                        },
                        {
                        "invert": false,
                        "type": "field",
                        "field": "name",
                        "modifier": null,
                        "operator": "equal",
                        "value": "Sheriff"
                        },
                        {
                        "invert": false,
                        "type": "field",
                        "field": "name",
                        "modifier": null,
                        "operator": "equal",
                        "value": "Bandit"
                        },
                        {
                        "invert": false,
                        "type": "field",
                        "field": "name",
                        "modifier": null,
                        "operator": "equal",
                        "value": "Astrid"
                        },
                        {
                        "invert": false,
                        "type": "field",
                        "field": "name",
                        "modifier": null,
                        "operator": "equal",
                        "value": "Roxy"
                        }
                    ],
                    "recursive": true
                    }
                ]
            }"#,
        );
        attempt_parse(
            r#"{
                "invert": false,
                "type": "person",
                "join": "&&",
                "queries": [
                    {
                        "invert": false,
                        "type": "field",
                        "field": "id",
                        "modifier": null,
                        "operator": "equal",
                        "value": "P:i9hZrZVwPP"
                    }
                ],
                "recursive": false
            }"#,
        );
        attempt_parse(
            r#"{
                "invert": false,
                "type": "person",
                "join": "&&",
                "queries": [
                    {
                        "invert": false,
                        "type": "field",
                        "field": "id",
                        "modifier": null,
                        "operator": "equal",
                        "value": "P:JDkiNRe5vR"
                    }
                ],
                "recursive": false
            }"#,
        );
        attempt_parse(
            r#"{
                "invert": false,
                "type": "compound",
                "join": "&&",
                "queries": [
                    {
                    "invert": false,
                    "type": "tag",
                    "join": "||",
                    "queries": [
                        {
                        "invert": false,
                        "type": "field",
                        "field": "id",
                        "modifier": null,
                        "operator": "equal",
                        "value": "T:R2BlPpCZ2m"
                        },
                        {
                        "invert": false,
                        "type": "field",
                        "field": "id",
                        "modifier": null,
                        "operator": "equal",
                        "value": "T:I35GY5cUF9"
                        }
                    ],
                    "recursive": false
                    }
                ]
            }"#,
        );
        attempt_parse(
            r#"{
                "invert": false,
                "type": "compound",
                "join": "&&",
                "queries": [
                    {
                        "invert": false,
                        "type": "field",
                        "field": "rating",
                        "modifier": null,
                        "operator": "equal",
                        "value": 5
                    }
                ]
            }"#,
        );
    }
}
