use diesel::{
    backend, deserialize,
    dsl::{self, not, sql},
    expression::AsExpression,
    helper_types::LeftJoinQuerySource,
    prelude::*,
    query_builder::AstPass,
    serialize,
    sql_types::{
        self, Bool, Double, Float, Integer, Nullable, SingleValue, SqlType, Text, Timestamp,
    },
};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_json::{from_value, Value};
use serde_plain::derive_display_from_serialize;
use typeshare::typeshare;

use crate::{
    shared::json::{expect_string, map, prop, Object},
    store::{
        db::{
            functions::{
                char_length, extract, media_field, media_view, media_view_columns,
                media_view_tables,
            },
            schema::*,
            Backend, DbConnection,
        },
        models,
    },
    Result,
};

type MediaViewQS = LeftJoinQuerySource<
    LeftJoinQuerySource<
        media_item::table,
        media_file::table,
        dsl::Eq<media_item::media_file, dsl::Nullable<media_file::id>>,
    >,
    media_file_alternates::table,
    dsl::Eq<media_item::media_file, dsl::Nullable<media_file_alternates::media_file>>,
>;
type Boxed<QS, T = Bool> = Box<dyn BoxableExpression<QS, Backend, SqlType = T>>;

pub(crate) type SearchQuery = CompoundQuery<CompoundItem>;

pub(crate) trait Filterable {
    type QuerySource;

    fn build_filter(&self, catalog: &str) -> Boxed<Self::QuerySource>;
}

pub(crate) fn field_query<F, FT>(
    field: F,
    operator: Operator,
    invert: bool,
) -> field_query::HelperType<F, FT>
where
    F: AsExpression<FT>,
    FT: SingleValue + SqlType,
{
    field_query::FieldQuery {
        field: field.as_expression(),
        operator,
        invert,
    }
}

pub(crate) mod field_query {
    use diesel::{
        expression::{
            is_aggregate, AppearsOnTable, Expression, SelectableExpression, ValidGrouping,
        },
        query_builder::{AstPass, QueryFragment, QueryId},
        QueryResult,
    };

    use super::*;

    #[derive(Debug, Clone, QueryId)]
    pub(crate) struct FieldQuery<F> {
        pub(super) field: F,
        pub(super) operator: Operator,
        pub(super) invert: bool,
    }

    impl<F, GroupByClause> ValidGrouping<GroupByClause> for FieldQuery<F> {
        type IsAggregate = is_aggregate::Never;
    }

    pub(crate) type HelperType<F, FT> = FieldQuery<<F as AsExpression<FT>>::Expression>;

    impl<F> Expression for FieldQuery<F>
    where
        F: Expression,
    {
        type SqlType = Bool;
    }

    impl<F, QS> SelectableExpression<QS> for FieldQuery<F>
    where
        F: SelectableExpression<QS>,
        Self: AppearsOnTable<QS>,
    {
    }

    impl<F, QS> AppearsOnTable<QS> for FieldQuery<F>
    where
        F: AppearsOnTable<QS>,
        Self: Expression,
    {
    }

    impl<F> QueryFragment<Backend> for FieldQuery<F>
    where
        F: QueryFragment<Backend>,
    {
        #[allow(unused_assignments)]
        fn walk_ast<'__b>(&'__b self, mut out: AstPass<'_, '__b, Backend>) -> QueryResult<()> {
            match (&self.operator, self.invert) {
                (Operator::Empty, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL");
                }
                (Operator::Empty, true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NOT NULL");
                }
                (Operator::Equal(SqlValue::String(v)), false) => {
                    out.push_sql("COALESCE(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(", ");
                    out.push_bind_param::<Text, _>("")?;
                    out.push_sql(") IS NOT DISTINCT FROM ");
                    out.push_bind_param::<Text, _>(v)?;
                }
                (Operator::Equal(SqlValue::String(v)), true) => {
                    out.push_sql("COALESCE(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(", ");
                    out.push_bind_param::<Text, _>("")?;
                    out.push_sql(") IS DISTINCT FROM ");
                    out.push_bind_param::<Text, _>(v)?;
                }
                (Operator::Equal(v), false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NOT DISTINCT FROM ");
                    v.bind_value(&mut out)?;
                }
                (Operator::Equal(v), true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS DISTINCT FROM ");
                    v.bind_value(&mut out)?;
                }
                (Operator::LessThan(v), false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" < ");
                    v.bind_value(&mut out)?;
                }
                (Operator::LessThan(v), true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" >= ");
                    v.bind_value(&mut out)?;
                }
                (Operator::LessThanOrEqual(v), false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" <= ");
                    v.bind_value(&mut out)?;
                }
                (Operator::LessThanOrEqual(v), true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" > ");
                    v.bind_value(&mut out)?;
                }
                (Operator::Contains(v), false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" LIKE '%' || ");
                    out.push_bind_param::<Text, _>(v)?;
                    out.push_sql(" || '%'");
                }
                (Operator::Contains(v), true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" NOT LIKE  '%' || ");
                    out.push_bind_param::<Text, _>(v)?;
                    out.push_sql(" || '%')");
                }
                (Operator::StartsWith(v), false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" LIKE ");
                    out.push_bind_param::<Text, _>(v)?;
                    out.push_sql(" || '%'");
                }
                (Operator::StartsWith(v), true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" NOT LIKE ");
                    out.push_bind_param::<Text, _>(v)?;
                    out.push_sql(" || '%')");
                }
                (Operator::EndsWith(v), false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" LIKE '%' || ");
                    out.push_bind_param::<Text, _>(v)?;
                }
                (Operator::EndsWith(v), true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" NOT LIKE '%' || ");
                    out.push_bind_param::<Text, _>(v)?;
                    out.push_sql(")");
                }
                (Operator::Matches(v), false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" ~ ");
                    out.push_bind_param::<Text, _>(v)?;
                }
                (Operator::Matches(v), true) => {
                    out.push_sql("(");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL OR ");
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" !~ ");
                    out.push_bind_param::<Text, _>(v)?;
                    out.push_sql(")");
                }
            }

            Ok(())
        }
    }
}

pub(crate) enum TypedField<QS> {
    Text(Boxed<QS, Nullable<Text>>),
    Float(Boxed<QS, Nullable<Float>>),
    Integer(Boxed<QS, Nullable<Integer>>),
    Date(Boxed<QS, Nullable<Timestamp>>),
}

pub(crate) trait Field {
    type QuerySource: 'static;

    fn field(&self) -> TypedField<Self::QuerySource>;
}

pub(crate) trait RelationField: Field {
    fn build_media_filter(
        catalog: &str,
        recursive: bool,
        filter: Boxed<Self::QuerySource>,
    ) -> Boxed<MediaViewQS>;
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
    fn bind_value<'__b>(&'__b self, out: &mut AstPass<'_, '__b, Backend>) -> QueryResult<()> {
        match self {
            SqlValue::String(f) => out.push_bind_param::<Text, _>(f),
            SqlValue::Bool(f) => out.push_bind_param::<Bool, _>(f),
            SqlValue::Integer(f) => out.push_bind_param::<Integer, _>(f),
            SqlValue::Double(f) => out.push_bind_param::<Double, _>(f),
        }
    }
}

#[typeshare]
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

#[typeshare]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Modifier {
    Length,
    Year,
    Month,
    Day,
    DayOfWeek,
}

derive_display_from_serialize!(Modifier);

#[typeshare]
#[derive(Debug, Default, Serialize, Deserialize, Clone, Copy)]
pub(crate) enum Join {
    #[default]
    #[serde(rename = "&&")]
    And,
    #[serde(rename = "||")]
    Or,
}

#[typeshare]
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
            MediaField::ShutterSpeed => TypedField::Float(Box::new(media_field!(shutter_speed))),

            MediaField::Longitude => TypedField::Float(Box::new(media_field!(longitude))),
            MediaField::Latitude => TypedField::Float(Box::new(media_field!(latitude))),
            MediaField::Altitude => TypedField::Float(Box::new(media_field!(altitude))),
            MediaField::Aperture => TypedField::Float(Box::new(media_field!(aperture))),
            MediaField::FocalLength => TypedField::Float(Box::new(media_field!(focal_length))),

            MediaField::Orientation => TypedField::Integer(Box::new(media_field!(orientation))),
            MediaField::Iso => TypedField::Integer(Box::new(media_field!(iso))),
            MediaField::Rating => TypedField::Integer(Box::new(media_field!(rating))),

            MediaField::Taken => TypedField::Date(Box::new(media_field!(taken))),

            MediaField::TakenZone => TypedField::Text(Box::new(media_item::taken_zone)),
        }
    }
}

#[typeshare]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum TagField {
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
    fn build_media_filter(
        catalog: &str,
        recursive: bool,
        filter: Boxed<Self::QuerySource>,
    ) -> Boxed<MediaViewQS> {
        if recursive {
            let select = tag::table
                .filter(tag::catalog.eq(catalog.to_owned()))
                .filter(filter)
                .into_boxed()
                .inner_join(tag_descendent::table.on(tag_descendent::id.eq(tag::id)))
                .inner_join(media_tag::table.on(media_tag::tag.eq(tag_descendent::descendent)))
                .select(media_tag::media);

            Box::new(media_item::id.eq_any(select))
        } else {
            let select = tag::table
                .filter(tag::catalog.eq(catalog.to_owned()))
                .filter(filter)
                .into_boxed()
                .inner_join(media_tag::table.on(media_tag::tag.eq(tag::id)))
                .select(media_tag::media);

            Box::new(media_item::id.eq_any(select))
        }
    }
}

#[typeshare]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum PersonField {
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
    fn build_media_filter(
        catalog: &str,
        _recursive: bool,
        filter: Boxed<Self::QuerySource>,
    ) -> Boxed<MediaViewQS> {
        let select = person::table
            .filter(person::catalog.eq(catalog.to_owned()))
            .filter(filter)
            .into_boxed()
            .inner_join(media_person::table.on(media_person::person.eq(person::id)))
            .select(media_person::media);

        Box::new(media_item::id.eq_any(select))
    }
}

#[typeshare]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AlbumField {
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
    fn build_media_filter(
        catalog: &str,
        recursive: bool,
        filter: Boxed<Self::QuerySource>,
    ) -> Boxed<MediaViewQS> {
        if recursive {
            let select = album::table
                .filter(album::catalog.eq(catalog.to_owned()))
                .filter(filter)
                .into_boxed()
                .inner_join(album_descendent::table.on(album_descendent::id.eq(album::id)))
                .inner_join(
                    media_album::table.on(media_album::album.eq(album_descendent::descendent)),
                )
                .select(media_album::media);

            Box::new(media_item::id.eq_any(select))
        } else {
            let select = album::table
                .filter(album::catalog.eq(catalog.to_owned()))
                .filter(filter)
                .into_boxed()
                .inner_join(media_album::table.on(media_album::album.eq(album::id)))
                .select(media_album::media);

            Box::new(media_item::id.eq_any(select))
        }
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

impl<F> Filterable for FieldQuery<F>
where
    F: Field,
{
    type QuerySource = F::QuerySource;

    fn build_filter(&self, _catalog: &str) -> Boxed<Self::QuerySource> {
        match self.field.field() {
            TypedField::Text(f) => match self.modifier {
                Some(Modifier::Length) => Box::new(field_query(
                    char_length(f),
                    self.operator.clone(),
                    self.invert,
                )),
                Some(ref m) => panic!("Unexpected modifier {m} for text"),
                None => Box::new(field_query(f, self.operator.clone(), self.invert)),
            },
            TypedField::Float(f) => {
                if let Some(ref m) = self.modifier {
                    panic!("Unexpected modifier {m} for float");
                }
                Box::new(field_query(f, self.operator.clone(), self.invert))
            }
            TypedField::Integer(f) => {
                if let Some(ref m) = self.modifier {
                    panic!("Unexpected modifier {m} for integer");
                }
                Box::new(field_query(f, self.operator.clone(), self.invert))
            }
            TypedField::Date(f) => match self.modifier {
                Some(Modifier::DayOfWeek) => Box::new(field_query(
                    extract(f, super::functions::DateComponent::DoW),
                    self.operator.clone(),
                    self.invert,
                )),
                Some(Modifier::Day) => Box::new(field_query(
                    extract(f, super::functions::DateComponent::Day),
                    self.operator.clone(),
                    self.invert,
                )),
                Some(Modifier::Month) => Box::new(field_query(
                    extract(f, super::functions::DateComponent::Month),
                    self.operator.clone(),
                    self.invert,
                )),
                Some(Modifier::Year) => Box::new(field_query(
                    extract(f, super::functions::DateComponent::Year),
                    self.operator.clone(),
                    self.invert,
                )),
                Some(ref m) => panic!("Unexpected modifier {m} for date"),
                None => Box::new(field_query(f, self.operator.clone(), self.invert)),
            },
        }
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
    type QuerySource = <F as Field>::QuerySource;

    fn build_filter(&self, catalog: &str) -> Boxed<Self::QuerySource> {
        match self {
            RelationCompoundItem::Field(f) => f.build_filter(catalog),
            RelationCompoundItem::Compound(f) => f.build_filter(catalog),
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
    type QuerySource = MediaViewQS;

    fn build_filter(&self, catalog: &str) -> Boxed<MediaViewQS> {
        F::build_media_filter(catalog, self.recursive, self.query.build_filter(catalog))
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
    type QuerySource = MediaViewQS;

    fn build_filter(&self, catalog: &str) -> Boxed<MediaViewQS> {
        match self {
            CompoundItem::Field(f) => f.build_filter(catalog),
            CompoundItem::Tag(f) => f.build_filter(catalog),
            CompoundItem::Person(f) => f.build_filter(catalog),
            CompoundItem::Album(f) => f.build_filter(catalog),
            CompoundItem::Compound(f) => f.build_filter(catalog),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, AsExpression, deserialize::FromSqlRow)]
#[diesel(sql_type = sql_types::Json)]
pub(crate) struct CompoundQuery<Q> {
    #[serde(default, skip_serializing_if = "is_false")]
    pub(crate) invert: bool,
    #[serde(default, skip_serializing_if = "is_and")]
    pub(crate) join: Join,
    pub(crate) queries: Vec<Q>,
}

impl CompoundQuery<CompoundItem> {
    pub(crate) async fn count(&self, conn: &mut DbConnection<'_>, catalog: &str) -> Result<i64> {
        let count = media_view_tables!()
            .filter(media_item::deleted.eq(false))
            .filter(media_item::catalog.eq(catalog))
            .filter(self.build_filter(catalog))
            .count()
            .get_result::<i64>(conn)
            .await?;

        Ok(count)
    }

    pub(crate) async fn list(
        &self,
        conn: &mut DbConnection<'_>,
        catalog: &str,
        offset: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<models::MediaView>> {
        let mut query = media_view!()
            .filter(media_item::catalog.eq(catalog))
            .filter(self.build_filter(catalog))
            .select(media_view_columns!())
            .offset(offset.unwrap_or_default())
            .into_boxed();

        if let Some(count) = count {
            query = query.limit(count);
        }

        Ok(query.load::<models::MediaView>(conn).await?)
    }
}

impl<Q> Filterable for CompoundQuery<Q>
where
    Q: Filterable,
    Q::QuerySource: 'static,
{
    type QuerySource = Q::QuerySource;

    fn build_filter(&self, catalog: &str) -> Boxed<Self::QuerySource> {
        if self.queries.is_empty() {
            if matches!(
                (self.invert, self.join),
                (false, Join::And) | (true, Join::Or)
            ) {
                return Box::new(sql::<Bool>("TRUE"));
            } else {
                return Box::new(sql::<Bool>("FALSE"));
            }
        }

        let mut filter: Boxed<Self::QuerySource> = self.queries[0].build_filter(catalog);

        for query in self.queries.iter().skip(1) {
            filter = match self.join {
                Join::And => Box::new(filter.and(query.build_filter(catalog))),
                Join::Or => Box::new(filter.or(query.build_filter(catalog))),
            };
        }

        if self.invert {
            Box::new(not(filter))
        } else {
            filter
        }
    }
}

fn upgrade_compound(obj: &mut Object) {
    if let Some(val) = obj.remove("relation") {
        obj.insert("type".to_string(), val);
    } else if let Some(Value::Array(list)) = obj.get_mut("queries") {
        for val in list {
            if let Value::Object(ref mut obj) = val {
                if matches!(
                    map!(prop!(obj, "type"), expect_string).as_deref(),
                    Some("compound")
                ) {
                    upgrade_compound(obj);
                }
            }
        }
    }
}

pub(crate) fn upgrade_query(query: Value) -> Result<SearchQuery> {
    if let Value::Object(mut obj) = query {
        match map!(prop!(obj, "type"), expect_string).as_deref() {
            Some("compound") => {
                upgrade_compound(&mut obj);

                if !matches!(
                    map!(prop!(obj, "type"), expect_string).as_deref(),
                    Some("compound"),
                ) {
                    // We must wrap this in a new compound query.
                    let inner_query: CompoundItem = from_value(Value::Object(obj))?;

                    let query = SearchQuery {
                        invert: false,
                        join: Join::default(),
                        queries: vec![inner_query],
                    };

                    Ok(query)
                } else {
                    Ok(from_value(Value::Object(obj))?)
                }
            }
            Some("field") => {
                // We must wrap this in a new compound query.
                let inner_query: CompoundItem = from_value(Value::Object(obj))?;

                let query = SearchQuery {
                    invert: false,
                    join: Join::default(),
                    queries: vec![inner_query],
                };

                Ok(query)
            }
            _ => {
                // This is unexpected. Just try to parse it.
                Ok(from_value(Value::Object(obj))?)
            }
        }
    } else {
        // This is unexpected. Just try to parse it.
        Ok(from_value(query)?)
    }
}

impl<DB> deserialize::FromSql<sql_types::Json, DB> for SearchQuery
where
    DB: backend::Backend,
    Value: deserialize::FromSql<sql_types::Json, DB>,
{
    fn from_sql(bytes: DB::RawValue<'_>) -> deserialize::Result<Self> {
        let value = Value::from_sql(bytes)?;
        Ok(serde_json::from_value(value)?)
    }
}

impl serialize::ToSql<sql_types::Json, diesel::pg::Pg> for SearchQuery
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
