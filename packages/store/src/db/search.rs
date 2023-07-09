use std::marker::PhantomData;

use diesel::{
    backend, deserialize,
    dsl::{self, not},
    expression::AsExpression,
    helper_types::LeftJoinQuerySource,
    pg::Pg,
    prelude::*,
    query_builder::QueryFragment,
    serialize,
    sql_types::{
        self, Bool, Double, Float, Integer, Nullable, SingleValue, SqlType, Text, Timestamp,
    },
};
use monostate::MustBe;
use serde::{
    de::Error,
    de::{DeserializeOwned, Unexpected},
    Deserialize, Deserializer, Serialize,
};
use serde_json::{Map, Value};
use serde_plain::derive_display_from_serialize;

use crate::schema::*;

use super::functions::{char_length, extract, media_field};

type MediaViewQS = LeftJoinQuerySource<
    media_item::table,
    media_file::table,
    dsl::Eq<media_item::media_file, dsl::Nullable<media_file::id>>,
>;
type Boxed<QS, T = Bool> = Box<dyn BoxableExpression<QS, Pg, SqlType = T>>;

pub(crate) fn field_query<QS, F, FT>(
    field: F,
    operator: Operator,
    value: &Option<Value>,
    invert: bool,
) -> Boxed<QS>
where
    F: AsExpression<FT>,
    FT: SingleValue + SqlType,
    <F as AsExpression<FT>>::Expression:
        'static + SelectableExpression<QS> + QueryFragment<Pg> + Send,
{
    match value {
        Some(Value::String(s)) => Box::new(field_query::FieldQuery::<_, String, Text> {
            field: field.as_expression(),
            operator,
            value: s.clone(),
            _sql_type: PhantomData,
            invert,
        }),
        Some(Value::Number(n)) => {
            if let Some(v) = n.as_i64() {
                Box::new(field_query::FieldQuery::<_, i32, Integer> {
                    field: field.as_expression(),
                    operator,
                    value: v as i32,
                    _sql_type: PhantomData,
                    invert,
                })
            } else if let Some(v) = n.as_f64() {
                Box::new(field_query::FieldQuery::<_, f64, Double> {
                    field: field.as_expression(),
                    operator,
                    value: v,
                    _sql_type: PhantomData,
                    invert,
                })
            } else {
                Box::new(field_query::FieldQuery::<_, i32, Integer> {
                    field: field.as_expression(),
                    operator,
                    value: 0,
                    _sql_type: PhantomData,
                    invert,
                })
            }
        }
        _ => Box::new(field_query::FieldQuery::<_, i32, Integer> {
            field: field.as_expression(),
            operator,
            value: 0,
            _sql_type: PhantomData,
            invert,
        }),
    }
}

pub(crate) mod field_query {
    use std::marker::PhantomData;

    use super::*;
    use diesel::{
        expression::{
            is_aggregate, AppearsOnTable, Expression, SelectableExpression, ValidGrouping,
        },
        query_builder::{AstPass, QueryFragment, QueryId},
        serialize::ToSql,
        sql_types::HasSqlType,
        QueryResult,
    };

    #[derive(Debug, Clone, QueryId)]
    pub(crate) struct FieldQuery<F, V, S> {
        pub(super) field: F,
        pub(super) operator: Operator,
        pub(super) value: V,
        pub(super) invert: bool,
        pub(super) _sql_type: PhantomData<S>,
    }

    impl<F, V, S, GroupByClause> ValidGrouping<GroupByClause> for FieldQuery<F, V, S> {
        type IsAggregate = is_aggregate::Never;
    }

    impl<F, V, S> Expression for FieldQuery<F, V, S>
    where
        F: Expression,
    {
        type SqlType = Bool;
    }

    impl<F, V, S, QS> SelectableExpression<QS> for FieldQuery<F, V, S>
    where
        F: SelectableExpression<QS>,
        Self: AppearsOnTable<QS>,
    {
    }

    impl<F, V, S, QS> AppearsOnTable<QS> for FieldQuery<F, V, S>
    where
        F: AppearsOnTable<QS>,
        Self: Expression,
    {
    }

    impl<F, S, V> QueryFragment<Pg> for FieldQuery<F, V, S>
    where
        F: QueryFragment<Pg>,
        V: ToSql<S, Pg>,
        Pg: HasSqlType<S>,
    {
        #[allow(unused_assignments)]
        fn walk_ast<'__b>(&'__b self, mut out: AstPass<'_, '__b, Pg>) -> QueryResult<()> {
            match (self.operator, self.invert) {
                (Operator::Empty, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL");
                }
                (Operator::Empty, true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NOT NULL");
                }
                (Operator::Equal, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NOT DISTINCT FROM ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::Equal, true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS DISTINCT FROM ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::LessThan, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" < ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::LessThan, true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" >= ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::LessThanOrEqual, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" <= ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::LessThanOrEqual, true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" > ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::Contains, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" LIKE ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::Contains, true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" NOT LIKE ");
                    out.push_bind_param(&self.value)?;
                    out.push_sql(")");
                }
                (Operator::StartsWith, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" LIKE ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::StartsWith, true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" NOT LIKE ");
                    out.push_bind_param(&self.value)?;
                    out.push_sql(")");
                }
                (Operator::EndsWith, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" LIKE ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::EndsWith, true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" NOT LIKE ");
                    out.push_bind_param(&self.value)?;
                    out.push_sql(")");
                }
                (Operator::Matches, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" ~ ");
                    out.push_bind_param(&self.value)?;
                }
                (Operator::Matches, true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" !~ ");
                    out.push_bind_param(&self.value)?;
                    out.push_sql(")");
                }
            }

            Ok(())
        }
    }
}

pub enum TypedField<QS> {
    Text(Boxed<QS, Nullable<Text>>),
    Float(Boxed<QS, Nullable<Float>>),
    Integer(Boxed<QS, Nullable<Integer>>),
    Date(Boxed<QS, Nullable<Timestamp>>),
}

pub trait Field {
    type QuerySource: 'static;

    fn field(&self) -> TypedField<Self::QuerySource> {
        todo!();
    }
}

pub trait RelationField: Field {
    fn relation_type() -> RelationType;

    fn media_filter(catalog: &str, filter: Boxed<Self::QuerySource>) -> Boxed<MediaViewQS>;
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RelationType {
    Tag,
    Album,
    Person,
}

derive_display_from_serialize!(RelationType);

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Operator {
    Empty,
    Equal,
    LessThan,
    #[serde(rename = "lessthanequal")]
    LessThanOrEqual,
    Contains,
    StartsWith,
    EndsWith,
    Matches,
}

derive_display_from_serialize!(Operator);

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Modifier {
    Length,
    Year,
    Month,
}

derive_display_from_serialize!(Modifier);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Join {
    #[serde(rename = "&&")]
    And,
    #[serde(rename = "||")]
    Or,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum MediaField {
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

impl Field for MediaField {
    type QuerySource = MediaViewQS;

    fn field(&self) -> TypedField<Self::QuerySource> {
        match self {
            MediaField::Title => TypedField::Text(Box::new(media_field!(title))),
            MediaField::Filename => TypedField::Text(Box::new(media_field!(filename))),
            MediaField::Description => TypedField::Text(Box::new(media_field!(description))),
            MediaField::Category => TypedField::Text(Box::new(media_field!(category))),
            MediaField::Label => TypedField::Text(Box::new(media_field!(label))),
            MediaField::Location => TypedField::Text(Box::new(media_field!(location))),
            MediaField::City => TypedField::Text(Box::new(media_field!(city))),
            MediaField::State => TypedField::Text(Box::new(media_field!(state))),
            MediaField::Country => TypedField::Text(Box::new(media_field!(country))),
            MediaField::Make => TypedField::Text(Box::new(media_field!(make))),
            MediaField::Model => TypedField::Text(Box::new(media_field!(model))),
            MediaField::Lens => TypedField::Text(Box::new(media_field!(lens))),
            MediaField::Photographer => TypedField::Text(Box::new(media_field!(photographer))),
            MediaField::ShutterSpeed => TypedField::Text(Box::new(media_field!(shutter_speed))),

            MediaField::Longitude => TypedField::Float(Box::new(media_field!(longitude))),
            MediaField::Latitude => TypedField::Float(Box::new(media_field!(latitude))),
            MediaField::Altitude => TypedField::Float(Box::new(media_field!(altitude))),
            MediaField::Aperture => TypedField::Float(Box::new(media_field!(aperture))),
            MediaField::FocalLength => TypedField::Float(Box::new(media_field!(focal_length))),

            MediaField::Orientation => TypedField::Integer(Box::new(media_field!(orientation))),
            MediaField::Iso => TypedField::Integer(Box::new(media_field!(iso))),
            MediaField::Rating => TypedField::Integer(Box::new(media_field!(rating))),

            MediaField::Taken => TypedField::Date(Box::new(media_field!(taken))),

            MediaField::TakenZone => TypedField::Text(Box::new(media_field!(taken_zone))),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum TagField {
    Id,
    Name,
}

impl Field for TagField {
    type QuerySource = tag::table;

    fn field(&self) -> TypedField<Self::QuerySource> {
        match self {
            Self::Id => TypedField::Text(Box::new(tag::id.nullable())),
            Self::Name => TypedField::Text(Box::new(tag::name.nullable())),
        }
    }
}

impl RelationField for TagField {
    fn relation_type() -> RelationType {
        RelationType::Tag
    }

    fn media_filter(catalog: &str, filter: Boxed<Self::QuerySource>) -> Boxed<MediaViewQS> {
        let select = tag::table
            .filter(tag::catalog.eq(catalog.to_owned()))
            .filter(filter)
            .into_boxed()
            .inner_join(media_tag::table.on(media_tag::tag.eq(tag::id)))
            .select(media_tag::media);

        Box::new(media_item::id.eq_any(select))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum PersonField {
    Id,
    Name,
}

impl Field for PersonField {
    type QuerySource = person::table;

    fn field(&self) -> TypedField<Self::QuerySource> {
        match self {
            Self::Id => TypedField::Text(Box::new(person::id.nullable())),
            Self::Name => TypedField::Text(Box::new(person::name.nullable())),
        }
    }
}

impl RelationField for PersonField {
    fn relation_type() -> RelationType {
        RelationType::Person
    }

    fn media_filter(catalog: &str, filter: Boxed<Self::QuerySource>) -> Boxed<MediaViewQS> {
        let select = person::table
            .filter(person::catalog.eq(catalog.to_owned()))
            .filter(filter)
            .into_boxed()
            .inner_join(media_person::table.on(media_person::person.eq(person::id)))
            .select(media_person::media);

        Box::new(media_item::id.eq_any(select))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum AlbumField {
    Id,
    Name,
}

impl Field for AlbumField {
    type QuerySource = album::table;

    fn field(&self) -> TypedField<Self::QuerySource> {
        match self {
            Self::Id => TypedField::Text(Box::new(album::id.nullable())),
            Self::Name => TypedField::Text(Box::new(album::name.nullable())),
        }
    }
}

impl RelationField for AlbumField {
    fn relation_type() -> RelationType {
        RelationType::Album
    }

    fn media_filter(catalog: &str, filter: Boxed<Self::QuerySource>) -> Boxed<MediaViewQS> {
        let select = album::table
            .filter(album::catalog.eq(catalog.to_owned()))
            .filter(filter)
            .into_boxed()
            .inner_join(media_album::table.on(media_album::album.eq(album::id)))
            .select(media_album::media);

        Box::new(media_item::id.eq_any(select))
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FieldQuery<F: Field> {
    #[serde(rename = "type")]
    _type: String,
    pub invert: bool,
    #[serde(bound(deserialize = "F: DeserializeOwned"))]
    pub field: F,
    pub modifier: Option<Modifier>,
    pub operator: Operator,
    pub value: Option<Value>,
}

impl<F: Field> FieldQuery<F> {
    fn filter(&self) -> Boxed<F::QuerySource> {
        match self.field.field() {
            TypedField::Text(f) => match self.modifier {
                Some(Modifier::Length) => Box::new(field_query(
                    char_length(f),
                    self.operator,
                    &self.value,
                    self.invert,
                )),
                Some(ref m) => panic!("Unexpected modifier {m} for text"),
                None => Box::new(field_query(f, self.operator, &self.value, self.invert)),
            },
            TypedField::Float(f) => {
                if let Some(ref m) = self.modifier {
                    panic!("Unexpected modifier {m} for float");
                }
                Box::new(field_query(f, self.operator, &self.value, self.invert))
            }
            TypedField::Integer(f) => {
                if let Some(ref m) = self.modifier {
                    panic!("Unexpected modifier {m} for integer");
                }
                Box::new(field_query(f, self.operator, &self.value, self.invert))
            }
            TypedField::Date(f) => match self.modifier {
                Some(Modifier::Month) => Box::new(field_query(
                    extract(f, super::functions::DateComponent::Month),
                    self.operator,
                    &self.value,
                    self.invert,
                )),
                Some(Modifier::Year) => Box::new(field_query(
                    extract(f, super::functions::DateComponent::Year),
                    self.operator,
                    &self.value,
                    self.invert,
                )),
                Some(ref m) => panic!("Unexpected modifier {m} for date"),
                None => Box::new(field_query(f, self.operator, &self.value, self.invert)),
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompoundQuery {
    #[serde(rename = "type")]
    _type: MustBe!("compound"),
    pub invert: bool,
    pub join: Join,
    pub queries: Vec<CompoundQueryItem>,
}

impl CompoundQuery {
    fn filter(&self, catalog: &str) -> Boxed<MediaViewQS> {
        let mut filter: Boxed<MediaViewQS> = self.queries[0].filter(catalog);

        for query in self.queries.iter().skip(1) {
            filter = match self.join {
                Join::And => Box::new(filter.and(query.filter(catalog))),
                Join::Or => Box::new(filter.or(query.filter(catalog))),
            };
        }

        if self.invert {
            Box::new(not(filter))
        } else {
            filter
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub enum RelationQueryItem<F: RelationField> {
    Compound(RelationQuery<F>),
    Field(FieldQuery<F>),
}

impl<F> RelationQueryItem<F>
where
    F: RelationField,
{
    fn filter(&self) -> Boxed<F::QuerySource> {
        match self {
            RelationQueryItem::Compound(q) => q.filter_relation(),
            RelationQueryItem::Field(q) => q.filter(),
        }
    }
}

fn deserialize_value<'de, D: Deserializer<'de>, T: DeserializeOwned>(
    value: Value,
) -> Result<T, D::Error> {
    serde_json::from_value::<T>(value).map_err(|e| D::Error::custom(e.to_string()))
}

impl<'de, F> Deserialize<'de> for RelationQueryItem<F>
where
    F: RelationField + DeserializeOwned,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let object = Map::<String, Value>::deserialize(deserializer)?;

        let typ = match object.get("type") {
            Some(Value::String(s)) => s.clone(),
            Some(v) => {
                return Err(D::Error::custom(format!(
                    "Expected `type` to be a string but got {v}"
                )))
            }
            None => return Err(D::Error::missing_field("type")),
        };

        match typ.as_str() {
            "field" => {
                let query = deserialize_value::<D, FieldQuery<F>>(Value::Object(object))?;
                Ok(Self::Field(query))
            }
            "compound" => {
                let rel = match object.get("relation") {
                    Some(v) => deserialize_value::<D, RelationType>(v.clone())?,
                    None => return Err(D::Error::missing_field("relation")),
                };

                if rel != F::relation_type() {
                    return Err(D::Error::invalid_value(
                        Unexpected::Str(&rel.to_string()),
                        &F::relation_type().to_string().as_str(),
                    ));
                }

                let query = deserialize_value::<D, RelationQuery<F>>(Value::Object(object))?;
                Ok(Self::Compound(query))
            }
            o => Err(D::Error::invalid_value(
                Unexpected::Str(o),
                &"`field` or `compound`",
            )),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RelationQuery<F: RelationField> {
    #[serde(rename = "type")]
    _type: String,
    pub invert: bool,
    pub join: Join,
    #[serde(bound(deserialize = "F: DeserializeOwned"))]
    pub queries: Vec<RelationQueryItem<F>>,
    pub relation: RelationType,
    pub recursive: bool,
}

impl<F: RelationField> RelationQuery<F> {
    fn filter_relation(&self) -> Boxed<F::QuerySource> {
        let mut filter: Boxed<F::QuerySource> = self.queries[0].filter();

        for query in self.queries.iter().skip(1) {
            filter = match self.join {
                Join::And => Box::new(filter.and(query.filter())),
                Join::Or => Box::new(filter.or(query.filter())),
            };
        }

        if self.invert {
            Box::new(not(filter))
        } else {
            filter
        }
    }

    fn filter(&self, catalog: &str) -> Boxed<MediaViewQS> {
        F::media_filter(catalog, self.filter_relation())
    }
}

#[derive(Debug, Serialize, Clone, AsExpression, deserialize::FromSqlRow)]
#[diesel(sql_type = sql_types::Json)]
pub enum CompoundQueryItem {
    Field(FieldQuery<MediaField>),
    Tag(RelationQuery<TagField>),
    Person(RelationQuery<PersonField>),
    Album(RelationQuery<AlbumField>),
    Compound(CompoundQuery),
}

impl CompoundQueryItem {
    pub(crate) fn filter(&self, catalog: &str) -> Boxed<MediaViewQS> {
        match self {
            CompoundQueryItem::Field(q) => q.filter(),
            CompoundQueryItem::Tag(q) => q.filter(catalog),
            CompoundQueryItem::Person(q) => q.filter(catalog),
            CompoundQueryItem::Album(q) => q.filter(catalog),
            CompoundQueryItem::Compound(q) => q.filter(catalog),
        }
    }
}

impl<'de> Deserialize<'de> for CompoundQueryItem {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let object = Map::<String, Value>::deserialize(deserializer)?;

        let typ = match object.get("type") {
            Some(Value::String(s)) => s.clone(),
            Some(v) => {
                return Err(D::Error::custom(format!(
                    "Expected `type` to be a string but got {v}"
                )))
            }
            None => return Err(D::Error::missing_field("type")),
        };

        match typ.as_str() {
            "field" => {
                let query = deserialize_value::<D, FieldQuery<MediaField>>(Value::Object(object))?;
                Ok(Self::Field(query))
            }
            "compound" => {
                let rel = match object.get("relation") {
                    Some(v) => Some(deserialize_value::<D, RelationType>(v.clone())?),
                    None => None,
                };

                match rel {
                    Some(RelationType::Album) => {
                        let query = deserialize_value::<D, RelationQuery<AlbumField>>(
                            Value::Object(object),
                        )?;
                        Ok(Self::Album(query))
                    }
                    Some(RelationType::Person) => {
                        let query = deserialize_value::<D, RelationQuery<PersonField>>(
                            Value::Object(object),
                        )?;
                        Ok(Self::Person(query))
                    }
                    Some(RelationType::Tag) => {
                        let query =
                            deserialize_value::<D, RelationQuery<TagField>>(Value::Object(object))?;
                        Ok(Self::Tag(query))
                    }
                    None => {
                        let query = deserialize_value::<D, CompoundQuery>(Value::Object(object))?;
                        Ok(Self::Compound(query))
                    }
                }
            }
            o => Err(D::Error::invalid_value(
                Unexpected::Str(o),
                &"`field` or `compound`",
            )),
        }
    }
}

impl<DB> deserialize::FromSql<sql_types::Json, DB> for CompoundQueryItem
where
    DB: backend::Backend,
    Value: deserialize::FromSql<sql_types::Json, DB>,
{
    fn from_sql(bytes: DB::RawValue<'_>) -> deserialize::Result<Self> {
        let value = Value::from_sql(bytes)?;
        Ok(serde_json::from_value(value)?)
    }
}

impl serialize::ToSql<sql_types::Json, diesel::pg::Pg> for CompoundQueryItem
where
    Value: serialize::ToSql<sql_types::Json, diesel::pg::Pg>,
{
    fn to_sql<'b>(
        &'b self,
        out: &mut serialize::Output<'b, '_, diesel::pg::Pg>,
    ) -> serialize::Result {
        let value = serde_json::to_value(self)?;
        <Value as serialize::ToSql<sql_types::Json, diesel::pg::Pg>>::to_sql(
            &value,
            &mut out.reborrow(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::CompoundQueryItem;

    fn attempt_parse(json: &str) {
        serde_json::from_str::<CompoundQueryItem>(json).unwrap();
    }

    #[test]
    fn parsing() {
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"compound","join":"||","queries":[{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:JDkiNRe5vR"},{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:i9hZrZVwPP"}],"relation":"person","recursive":false}]}"#,
        );
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"compound","join":"||","queries":[{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:JDkiNRe5vR"},{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:i9hZrZVwPP"},{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:74GYRgwkjS"},{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:JUUyyvwyBN"}],"relation":"person","recursive":true}]}"#,
        );
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:JUUyyvwyBN"}],"relation":"person","recursive":false}"#,
        );
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"compound","join":"||","queries":[{"invert":false,"type":"field","field":"name","modifier":null,"operator":"equal","value":"Loki"},{"invert":false,"type":"field","field":"name","modifier":null,"operator":"equal","value":"Ripley"},{"invert":false,"type":"field","field":"name","modifier":null,"operator":"equal","value":"Sheriff"},{"invert":false,"type":"field","field":"name","modifier":null,"operator":"equal","value":"Bandit"},{"invert":false,"type":"field","field":"name","modifier":null,"operator":"equal","value":"Astrid"},{"invert":false,"type":"field","field":"name","modifier":null,"operator":"equal","value":"Roxy"}],"relation":"tag","recursive":true}]}"#,
        );
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:i9hZrZVwPP"}],"relation":"person","recursive":false}"#,
        );
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"P:JDkiNRe5vR"}],"relation":"person","recursive":false}"#,
        );
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"compound","join":"||","queries":[{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"T:R2BlPpCZ2m"},{"invert":false,"type":"field","field":"id","modifier":null,"operator":"equal","value":"T:I35GY5cUF9"}],"relation":"tag","recursive":false}]}"#,
        );
        attempt_parse(
            r#"{"invert":false,"type":"compound","join":"&&","queries":[{"invert":false,"type":"field","field":"rating","modifier":null,"operator":"equal","value":5}]}"#,
        );
    }
}
