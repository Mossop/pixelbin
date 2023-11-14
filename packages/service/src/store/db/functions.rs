use diesel::{expression::AsExpression, sql_function, sql_types::*};

sql_function!(
    #[sql_name = "GREATEST"]
    fn greatest(a: Timestamptz, b: Nullable<Timestamptz>) -> Timestamptz
);

sql_function!(
    fn char_length(a: Nullable<Text>) -> Nullable<Integer>
);

sql_function!(
    fn coalesce<T: SingleValue>(a: Nullable<T>, b: Nullable<T>) -> Nullable<T>
);

#[derive(Clone, Copy, Debug)]
pub(crate) enum DateComponent {
    Year,
    Month,
}

pub(crate) fn extract<A>(a: A, c: DateComponent) -> extract::HelperType<A>
where
    A: AsExpression<Nullable<Timestamp>>,
{
    extract::Extract {
        a: a.as_expression(),
        c,
    }
}

pub(crate) mod extract {
    use diesel::expression::{
        is_aggregate, AppearsOnTable, AsExpression, Expression, SelectableExpression, ValidGrouping,
    };
    use diesel::query_builder::{AstPass, QueryFragment, QueryId};
    use diesel::{self, QueryResult};

    use super::*;

    #[derive(Debug, Clone, Copy, QueryId)]
    pub(crate) struct Extract<A> {
        pub(super) a: A,
        pub(super) c: DateComponent,
    }

    impl<A, GroupByClause> ValidGrouping<GroupByClause> for Extract<A> {
        type IsAggregate = is_aggregate::Never;
    }

    pub(crate) type HelperType<A> = Extract<<A as AsExpression<Nullable<Timestamp>>>::Expression>;

    impl<A> Expression for Extract<A>
    where
        A: Expression,
    {
        type SqlType = Nullable<Integer>;
    }

    impl<A, QS> SelectableExpression<QS> for Extract<A>
    where
        A: SelectableExpression<QS>,
        Self: AppearsOnTable<QS>,
    {
    }

    impl<A, QS> AppearsOnTable<QS> for Extract<A>
    where
        A: AppearsOnTable<QS>,
        Self: Expression,
    {
    }

    impl<A, QS> QueryFragment<QS> for Extract<A>
    where
        QS: diesel::backend::Backend,
        A: QueryFragment<QS>,
    {
        #[allow(unused_assignments)]
        fn walk_ast<'__b>(&'__b self, mut out: AstPass<'_, '__b, QS>) -> QueryResult<()> {
            out.push_sql("EXTRACT(");
            match self.c {
                DateComponent::Month => out.push_sql("MONTH"),
                DateComponent::Year => out.push_sql("YEAR"),
            }
            out.push_sql(" FROM ");
            self.a.walk_ast(out.reborrow())?;
            out.push_sql(")");
            Ok(())
        }
    }
}

pub(crate) fn select_zone<A, B, C>(a: A, b: B, c: C) -> select_zone::HelperType<A, B, C>
where
    A: AsExpression<Nullable<Timestamp>>,
    B: AsExpression<Nullable<Text>>,
    C: AsExpression<Nullable<Text>>,
{
    select_zone::SelectZone {
        a: a.as_expression(),
        b: b.as_expression(),
        c: c.as_expression(),
    }
}

pub(crate) mod select_zone {
    use diesel::expression::{
        is_aggregate, AppearsOnTable, AsExpression, Expression, SelectableExpression, ValidGrouping,
    };
    use diesel::query_builder::{AstPass, QueryFragment, QueryId};
    use diesel::{self, QueryResult};

    use super::*;

    #[derive(Debug, Clone, Copy, QueryId)]
    pub(crate) struct SelectZone<A, B, C> {
        pub(super) a: A,
        pub(super) b: B,
        pub(super) c: C,
    }

    impl<A, B, C, GroupByClause> ValidGrouping<GroupByClause> for SelectZone<A, B, C> {
        type IsAggregate = is_aggregate::Never;
    }

    pub(crate) type HelperType<A, B, C> = SelectZone<
        <A as AsExpression<Nullable<Timestamp>>>::Expression,
        <B as AsExpression<Nullable<Text>>>::Expression,
        <C as AsExpression<Nullable<Text>>>::Expression,
    >;

    impl<A, B, C> Expression for SelectZone<A, B, C>
    where
        (A, B, C): Expression,
    {
        type SqlType = Nullable<Text>;
    }

    impl<A, B, C, QS> SelectableExpression<QS> for SelectZone<A, B, C>
    where
        A: SelectableExpression<QS>,
        B: SelectableExpression<QS>,
        C: SelectableExpression<QS>,
        Self: AppearsOnTable<QS>,
    {
    }

    impl<A, B, C, QS> AppearsOnTable<QS> for SelectZone<A, B, C>
    where
        A: AppearsOnTable<QS>,
        B: AppearsOnTable<QS>,
        C: AppearsOnTable<QS>,
        Self: Expression,
    {
    }

    impl<A, B, C, QS> QueryFragment<QS> for SelectZone<A, B, C>
    where
        QS: diesel::backend::Backend,
        A: QueryFragment<QS>,
        B: QueryFragment<QS>,
        C: QueryFragment<QS>,
    {
        #[allow(unused_assignments)]
        fn walk_ast<'__b>(&'__b self, mut out: AstPass<'_, '__b, QS>) -> QueryResult<()> {
            out.push_sql("CASE WHEN ");
            self.a.walk_ast(out.reborrow())?;
            out.push_sql(" IS NULL THEN ");
            self.b.walk_ast(out.reborrow())?;
            out.push_sql(" ELSE ");
            self.c.walk_ast(out.reborrow())?;
            out.push_sql(" END");
            Ok(())
        }
    }
}

macro_rules! media_field {
    (taken_zone) => {
        crate::store::db::functions::select_zone(
            crate::store::db::schema::media_item::taken,
            crate::store::db::schema::media_item::taken_zone,
            crate::store::db::schema::media_file::taken_zone.nullable(),
        )
    };
    ($field:ident) => {
        crate::store::db::functions::coalesce(
            crate::store::db::schema::media_item::$field,
            crate::store::db::schema::media_file::$field.nullable(),
        )
    };
}

macro_rules! media_view_columns {
    () => {
        (
            crate::store::db::schema::media_item::id,
            crate::store::db::schema::media_item::catalog,
            crate::store::db::schema::media_item::created,
            crate::store::db::functions::greatest(
                crate::store::db::schema::media_item::updated,
                crate::store::db::schema::media_file::uploaded.nullable(),
            ),
            crate::store::db::schema::media_item::datetime,
            crate::store::db::functions::media_field!(filename),
            crate::store::db::functions::media_field!(title),
            crate::store::db::functions::media_field!(description),
            crate::store::db::functions::media_field!(label),
            crate::store::db::functions::media_field!(category),
            crate::store::db::functions::media_field!(taken),
            crate::store::db::functions::media_field!(taken_zone),
            crate::store::db::functions::media_field!(longitude),
            crate::store::db::functions::media_field!(latitude),
            crate::store::db::functions::media_field!(altitude),
            crate::store::db::functions::media_field!(location),
            crate::store::db::functions::media_field!(city),
            crate::store::db::functions::media_field!(state),
            crate::store::db::functions::media_field!(country),
            crate::store::db::functions::media_field!(orientation),
            crate::store::db::functions::media_field!(make),
            crate::store::db::functions::media_field!(model),
            crate::store::db::functions::media_field!(lens),
            crate::store::db::functions::media_field!(photographer),
            crate::store::db::functions::media_field!(aperture),
            crate::store::db::functions::media_field!(shutter_speed),
            crate::store::db::functions::media_field!(iso),
            crate::store::db::functions::media_field!(focal_length),
            crate::store::db::functions::media_field!(rating),
            (
                crate::store::db::schema::media_file::id,
                crate::store::db::schema::media_file::file_size,
                crate::store::db::schema::media_file::mimetype,
                crate::store::db::schema::media_file::width,
                crate::store::db::schema::media_file::height,
                crate::store::db::schema::media_file::duration,
                crate::store::db::schema::media_file::frame_rate,
                crate::store::db::schema::media_file::bit_rate,
                crate::store::db::schema::media_file::uploaded,
                crate::store::db::schema::media_file::file_name,
            )
                .nullable(),
        )
    };
}

macro_rules! media_view {
    () => {
        crate::store::db::schema::media_item::table
            .left_outer_join(
                crate::store::db::schema::media_file::table
                    .on(crate::store::db::schema::media_item::media_file
                        .eq(crate::store::db::schema::media_file::id.nullable())),
            )
            .distinct_on((
                crate::store::db::schema::media_item::datetime,
                crate::store::db::schema::media_item::id,
            ))
            .order((
                crate::store::db::schema::media_item::datetime.desc(),
                crate::store::db::schema::media_item::id,
            ))
    };
}

pub(crate) use media_field;
pub(crate) use media_view;
pub(crate) use media_view_columns;
