use diesel::{
    backend, deserialize,
    dsl::{self, not},
    expression::AsExpression,
    helper_types::LeftJoinQuerySource,
    pg::Pg,
    prelude::*,
    query_builder::AstPass,
    serialize,
    sql_types::{
        self, Bool, Double, Float, Integer, Nullable, SingleValue, SqlType, Text, Timestamp,
    },
};
use monostate::MustBe;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_plain::derive_display_from_serialize;
use typeshare::typeshare;

use crate::store::db::{
    functions::{char_length, extract, media_field},
    schema::*,
};

type MediaViewQS = LeftJoinQuerySource<
    media_item::table,
    media_file::table,
    dsl::Eq<media_item::media_file, dsl::Nullable<media_file::id>>,
>;
type Boxed<QS, T = Bool> = Box<dyn BoxableExpression<QS, Pg, SqlType = T>>;

pub(crate) trait FilterGen<QS> {
    fn filter_gen(&self, catalog: &str) -> Boxed<QS>;
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

    impl<F> QueryFragment<Pg> for FieldQuery<F>
    where
        F: QueryFragment<Pg>,
    {
        #[allow(unused_assignments)]
        fn walk_ast<'__b>(&'__b self, mut out: AstPass<'_, '__b, Pg>) -> QueryResult<()> {
            match (&self.operator, self.invert) {
                (Operator::Empty, false) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NULL");
                }
                (Operator::Empty, true) => {
                    self.field.walk_ast(out.reborrow())?;
                    out.push_sql(" IS NOT NULL");
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
    fn media_filter(catalog: &str, filter: Boxed<Self::QuerySource>) -> Boxed<MediaViewQS>;
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum SqlValue {
    String(String),
    Bool(bool),
    Integer(i32),
    Double(f64),
}

impl SqlValue {
    fn bind_value<'__b>(&'__b self, out: &mut AstPass<'_, '__b, Pg>) -> QueryResult<()> {
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
pub enum Operator {
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
pub enum Modifier {
    Length,
    Year,
    Month,
}

derive_display_from_serialize!(Modifier);

#[typeshare]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) enum Join {
    #[serde(rename = "&&")]
    And,
    #[serde(rename = "||")]
    Or,
}

#[typeshare]
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
pub struct FieldQuery<F> {
    #[serde(rename = "type")]
    _type: String,
    pub invert: bool,
    pub field: F,
    pub modifier: Option<Modifier>,
    #[serde(flatten)]
    pub operator: Operator,
}

impl<F, QS> FilterGen<QS> for FieldQuery<F>
where
    QS: 'static,
    F: Field<QuerySource = QS>,
{
    fn filter_gen(&self, _catalog: &str) -> Boxed<QS> {
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
#[serde(untagged)]
pub(crate) enum RelationQueryItem<R, F> {
    Field(FieldQuery<F>),
    Compound(R),
}

impl<R, F, QS> FilterGen<QS> for RelationQueryItem<R, F>
where
    R: FilterGen<QS>,
    FieldQuery<F>: FilterGen<QS>,
{
    fn filter_gen(&self, catalog: &str) -> Boxed<QS> {
        match self {
            RelationQueryItem::Field(f) => f.filter_gen(catalog),
            RelationQueryItem::Compound(f) => f.filter_gen(catalog),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagRelation {
    #[serde(rename = "type")]
    _type: MustBe!("compound"),
    #[serde(flatten)]
    joined: JoinedQueries<RelationQueryItem<TagRelation, TagField>>,
    #[serde(rename = "relation")]
    _relation: MustBe!("tag"),
}

impl FilterGen<tag::table> for TagRelation {
    fn filter_gen(&self, catalog: &str) -> Boxed<tag::table> {
        self.joined.filter_gen(catalog)
    }
}

impl FilterGen<MediaViewQS> for TagRelation {
    fn filter_gen(&self, catalog: &str) -> Boxed<MediaViewQS> {
        TagField::media_filter(
            catalog,
            <Self as FilterGen<tag::table>>::filter_gen(self, catalog),
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlbumRelation {
    #[serde(rename = "type")]
    _type: MustBe!("compound"),
    #[serde(flatten)]
    joined: JoinedQueries<RelationQueryItem<AlbumRelation, AlbumField>>,
    #[serde(rename = "relation")]
    _relation: MustBe!("album"),
}

impl FilterGen<album::table> for AlbumRelation {
    fn filter_gen(&self, catalog: &str) -> Boxed<album::table> {
        self.joined.filter_gen(catalog)
    }
}

impl FilterGen<MediaViewQS> for AlbumRelation {
    fn filter_gen(&self, catalog: &str) -> Boxed<MediaViewQS> {
        AlbumField::media_filter(
            catalog,
            <Self as FilterGen<album::table>>::filter_gen(self, catalog),
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonRelation {
    #[serde(rename = "type")]
    _type: MustBe!("compound"),
    #[serde(flatten)]
    joined: JoinedQueries<RelationQueryItem<PersonRelation, PersonField>>,
    #[serde(rename = "relation")]
    _relation: MustBe!("person"),
}

impl FilterGen<person::table> for PersonRelation {
    fn filter_gen(&self, catalog: &str) -> Boxed<person::table> {
        self.joined.filter_gen(catalog)
    }
}

impl FilterGen<MediaViewQS> for PersonRelation {
    fn filter_gen(&self, catalog: &str) -> Boxed<MediaViewQS> {
        PersonField::media_filter(
            catalog,
            <Self as FilterGen<person::table>>::filter_gen(self, catalog),
        )
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, AsExpression, deserialize::FromSqlRow)]
#[diesel(sql_type = sql_types::Json)]
#[serde(untagged)]
pub enum CompoundQueryItem {
    Field(FieldQuery<MediaField>),
    Tag(TagRelation),
    Person(PersonRelation),
    Album(AlbumRelation),
    Compound(CompoundQuery),
}

impl FilterGen<MediaViewQS> for CompoundQueryItem {
    fn filter_gen(&self, catalog: &str) -> Boxed<MediaViewQS> {
        match self {
            CompoundQueryItem::Field(f) => f.filter_gen(catalog),
            CompoundQueryItem::Tag(f) => f.filter_gen(catalog),
            CompoundQueryItem::Person(f) => f.filter_gen(catalog),
            CompoundQueryItem::Album(f) => f.filter_gen(catalog),
            CompoundQueryItem::Compound(f) => f.filter_gen(catalog),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct JoinedQueries<Q> {
    pub(crate) invert: bool,
    pub(crate) join: Join,
    pub(crate) queries: Vec<Q>,
}

impl<Q, QS> FilterGen<QS> for JoinedQueries<Q>
where
    QS: 'static,
    Q: FilterGen<QS>,
{
    fn filter_gen(&self, catalog: &str) -> Boxed<QS> {
        let mut filter: Boxed<QS> = self.queries[0].filter_gen(catalog);

        for query in self.queries.iter().skip(1) {
            filter = match self.join {
                Join::And => Box::new(filter.and(query.filter_gen(catalog))),
                Join::Or => Box::new(filter.or(query.filter_gen(catalog))),
            };
        }

        if self.invert {
            Box::new(not(filter))
        } else {
            filter
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompoundQuery {
    #[serde(rename = "type")]
    _type: MustBe!("compound"),
    #[serde(flatten)]
    joined: JoinedQueries<CompoundQueryItem>,
}

impl FilterGen<MediaViewQS> for CompoundQuery {
    fn filter_gen(&self, catalog: &str) -> Boxed<MediaViewQS> {
        self.joined.filter_gen(catalog)
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
        attempt_parse(r#"{"invert":false,"type":"compound","join":"&&","queries":[]}"#);
        attempt_parse(r#"{"invert":true,"type":"compound","join":"||","queries":[]}"#);
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
