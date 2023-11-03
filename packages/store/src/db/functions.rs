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
    use super::*;
    use diesel::expression::{
        is_aggregate, AppearsOnTable, AsExpression, Expression, SelectableExpression, ValidGrouping,
    };
    use diesel::query_builder::{AstPass, QueryFragment, QueryId};
    use diesel::{self, QueryResult};

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
    use super::*;
    use diesel::expression::{
        is_aggregate, AppearsOnTable, AsExpression, Expression, SelectableExpression, ValidGrouping,
    };
    use diesel::query_builder::{AstPass, QueryFragment, QueryId};
    use diesel::{self, QueryResult};

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
        crate::db::functions::select_zone(
            crate::schema::media_item::taken,
            crate::schema::media_item::taken_zone,
            crate::schema::media_file::taken_zone.nullable(),
        )
    };
    ($field:ident) => {
        crate::db::functions::coalesce(
            crate::schema::media_item::$field,
            crate::schema::media_file::$field.nullable(),
        )
    };
}

macro_rules! media_view {
    () => {
        crate::schema::media_item::table
            .left_outer_join(crate::schema::media_file::table.on(
                crate::schema::media_item::media_file.eq(crate::schema::media_file::id.nullable()),
            ))
            .select((
                crate::schema::media_item::id,
                crate::schema::media_item::catalog,
                crate::schema::media_item::created,
                crate::db::functions::greatest(
                    crate::schema::media_item::updated,
                    crate::schema::media_file::uploaded.nullable(),
                ),
                crate::schema::media_item::datetime,
                crate::db::functions::media_field!(filename),
                crate::db::functions::media_field!(title),
                crate::db::functions::media_field!(description),
                crate::db::functions::media_field!(label),
                crate::db::functions::media_field!(category),
                crate::db::functions::media_field!(taken),
                crate::db::functions::media_field!(taken_zone),
                crate::db::functions::media_field!(longitude),
                crate::db::functions::media_field!(latitude),
                crate::db::functions::media_field!(altitude),
                crate::db::functions::media_field!(location),
                crate::db::functions::media_field!(city),
                crate::db::functions::media_field!(state),
                crate::db::functions::media_field!(country),
                crate::db::functions::media_field!(orientation),
                crate::db::functions::media_field!(make),
                crate::db::functions::media_field!(model),
                crate::db::functions::media_field!(lens),
                crate::db::functions::media_field!(photographer),
                crate::db::functions::media_field!(aperture),
                crate::db::functions::media_field!(shutter_speed),
                crate::db::functions::media_field!(iso),
                crate::db::functions::media_field!(focal_length),
                crate::db::functions::media_field!(rating),
                (
                    crate::schema::media_file::id,
                    crate::schema::media_file::file_size,
                    crate::schema::media_file::mimetype,
                    crate::schema::media_file::width,
                    crate::schema::media_file::height,
                    crate::schema::media_file::duration,
                    crate::schema::media_file::frame_rate,
                    crate::schema::media_file::bit_rate,
                    crate::schema::media_file::uploaded,
                    crate::schema::media_file::file_name,
                )
                    .nullable(),
            ))
            .distinct()
            .order(crate::schema::media_item::datetime.desc())
    };
}

pub(crate) use media_field;
pub(crate) use media_view;
