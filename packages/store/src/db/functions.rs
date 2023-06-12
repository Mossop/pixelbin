use std::marker::PhantomData;

use diesel::{expression::AsExpression, sql_function, sql_types::*};

sql_function!(
    #[sql_name = "GREATEST"]
    fn greatest(a: Timestamptz, b: Nullable<Timestamptz>) -> Timestamptz
);

pub(crate) fn coalesce<T, A, B>(a: A, b: B) -> coalesce::HelperType<T, A, B>
where
    A: AsExpression<Nullable<T>>,
    B: AsExpression<Nullable<T>>,
    T: SingleValue + SqlType,
{
    coalesce::Coalesce {
        a: a.as_expression(),
        b: b.as_expression(),
        _output: PhantomData,
    }
}

pub(crate) mod coalesce {
    use std::marker::PhantomData;

    use super::*;
    use diesel::expression::{
        is_aggregate, AppearsOnTable, AsExpression, Expression, SelectableExpression, ValidGrouping,
    };
    use diesel::query_builder::{AstPass, QueryFragment, QueryId};
    use diesel::{self, QueryResult};

    #[derive(Debug, Clone, Copy, QueryId)]
    pub(crate) struct Coalesce<T, A, B> {
        pub(super) a: A,
        pub(super) b: B,
        pub(super) _output: PhantomData<T>,
    }

    impl<T, A, B, GroupByClause> ValidGrouping<GroupByClause> for Coalesce<T, A, B> {
        type IsAggregate = is_aggregate::Never;
    }

    pub(crate) type HelperType<T, A, B> = Coalesce<
        T,
        <A as AsExpression<Nullable<T>>>::Expression,
        <B as AsExpression<Nullable<T>>>::Expression,
    >;

    impl<T, A, B> Expression for Coalesce<T, A, B>
    where
        (A, B): Expression,
        T: SingleValue,
    {
        type SqlType = Nullable<T>;
    }

    impl<T, A, B, QS> SelectableExpression<QS> for Coalesce<T, A, B>
    where
        A: SelectableExpression<QS>,
        B: SelectableExpression<QS>,
        Self: AppearsOnTable<QS>,
    {
    }

    impl<T, A, B, QS> AppearsOnTable<QS> for Coalesce<T, A, B>
    where
        A: AppearsOnTable<QS>,
        B: AppearsOnTable<QS>,
        Self: Expression,
    {
    }

    impl<T, A, B, QS> QueryFragment<QS> for Coalesce<T, A, B>
    where
        QS: diesel::backend::Backend,
        A: QueryFragment<QS>,
        B: QueryFragment<QS>,
    {
        #[allow(unused_assignments)]
        fn walk_ast<'__b>(&'__b self, mut out: AstPass<'_, '__b, QS>) -> QueryResult<()> {
            out.push_sql("COALESCE(");
            self.a.walk_ast(out.reborrow())?;
            out.push_sql(", ");
            self.b.walk_ast(out.reborrow())?;
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
