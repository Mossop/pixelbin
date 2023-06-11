use diesel::{backend, deserialize, serialize, sql_types, AsExpression};
use monostate::MustBe;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum RelationType {
    Tag,
    Album,
    Person,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum Modifier {
    Length,
    Year,
    Month,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Join {
    #[serde(rename = "&&")]
    And,
    #[serde(rename = "||")]
    Or,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FieldQuery {
    #[serde(rename = "type")]
    _type: MustBe!("field"),
    pub invert: bool,
    pub field: String,
    pub modifier: Option<Modifier>,
    pub operator: Operator,
    pub value: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompoundQuery {
    #[serde(rename = "type")]
    _type: MustBe!("compound"),
    pub invert: bool,
    pub join: Join,
    pub queries: Vec<Query>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RelationQuery {
    #[serde(rename = "type")]
    _type: MustBe!("compound"),
    pub invert: bool,
    pub join: Join,
    pub queries: Vec<Query>,
    pub relation: RelationType,
    pub recursive: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, AsExpression, deserialize::FromSqlRow)]
#[diesel(sql_type = sql_types::Json)]
#[serde(untagged)]
pub enum Query {
    Field(FieldQuery),
    Relation(RelationQuery),
    Compound(CompoundQuery),
}

impl<DB> deserialize::FromSql<sql_types::Json, DB> for Query
where
    DB: backend::Backend,
    Value: deserialize::FromSql<sql_types::Json, DB>,
{
    fn from_sql(bytes: backend::RawValue<DB>) -> deserialize::Result<Self> {
        let value = Value::from_sql(bytes)?;
        Ok(serde_json::from_value(value)?)
    }
}

impl serialize::ToSql<sql_types::Json, diesel::pg::Pg> for Query
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
    use super::Query;

    fn attempt_parse(json: &str) {
        serde_json::from_str::<Query>(json).unwrap();
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
