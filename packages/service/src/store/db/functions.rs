use diesel::{define_sql_function, expression::AsExpression, sql_types::*};

define_sql_function!(
    #[sql_name = "GREATEST"]
    fn greatest(a: Timestamptz, b: Nullable<Timestamptz>) -> Timestamptz
);

define_sql_function!(
    fn char_length(a: Nullable<Text>) -> Nullable<Integer>
);

define_sql_function!(
    fn coalesce<T: SingleValue>(a: Nullable<T>, b: Nullable<T>) -> Nullable<T>
);

define_sql_function!(
    #[sql_name = "LOWER"]
    fn lower(a: Text) -> Text
);

#[derive(Clone, Copy, Debug)]
pub(crate) enum DateComponent {
    Year,
    Month,
    Day,
    DoW,
}

pub(crate) fn extract<A>(a: A, c: DateComponent) -> extract::HelperType<A>
where
    A: AsExpression<Nullable<Timestamptz>>,
{
    extract::Extract {
        a: a.as_expression(),
        c,
    }
}

pub(crate) mod extract {
    use diesel::{
        self,
        expression::{
            is_aggregate, AppearsOnTable, AsExpression, Expression, SelectableExpression,
            ValidGrouping,
        },
        query_builder::{AstPass, QueryFragment, QueryId},
        QueryResult,
    };

    use super::*;

    #[derive(Debug, Clone, Copy, QueryId)]
    pub(crate) struct Extract<A> {
        pub(super) a: A,
        pub(super) c: DateComponent,
    }

    impl<A, GroupByClause> ValidGrouping<GroupByClause> for Extract<A> {
        type IsAggregate = is_aggregate::Never;
    }

    pub(crate) type HelperType<A> = Extract<<A as AsExpression<Nullable<Timestamptz>>>::Expression>;

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
                DateComponent::DoW => out.push_sql("DOW"),
                DateComponent::Day => out.push_sql("DAY"),
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

macro_rules! media_metadata_columns {
    ($table:ident) => {
        (
            crate::store::db::schema::$table::filename,
            crate::store::db::schema::$table::title,
            crate::store::db::schema::$table::description,
            crate::store::db::schema::$table::label,
            crate::store::db::schema::$table::category,
            crate::store::db::schema::$table::location,
            crate::store::db::schema::$table::city,
            crate::store::db::schema::$table::state,
            crate::store::db::schema::$table::country,
            crate::store::db::schema::$table::make,
            crate::store::db::schema::$table::model,
            crate::store::db::schema::$table::lens,
            crate::store::db::schema::$table::photographer,
            crate::store::db::schema::$table::shutter_speed,
            crate::store::db::schema::$table::orientation,
            crate::store::db::schema::$table::iso,
            crate::store::db::schema::$table::rating,
            crate::store::db::schema::$table::longitude,
            crate::store::db::schema::$table::latitude,
            crate::store::db::schema::$table::altitude,
            crate::store::db::schema::$table::aperture,
            crate::store::db::schema::$table::focal_length,
            crate::store::db::schema::$table::taken,
        )
    };
}

macro_rules! media_item_columns {
    () => {
        (
            crate::store::db::schema::media_item::id,
            crate::store::db::schema::media_item::deleted,
            crate::store::db::schema::media_item::created,
            crate::store::db::schema::media_item::updated,
            crate::store::db::functions::media_metadata_columns!(media_item),
            crate::store::db::schema::media_item::taken_zone,
            crate::store::db::schema::media_item::catalog,
            crate::store::db::schema::media_item::media_file,
            crate::store::db::schema::media_item::datetime,
            crate::store::db::schema::media_item::public,
        )
    };
}

macro_rules! media_file_columns {
    ($table:ident) => {
        (
            crate::store::db::schema::$table::id,
            crate::store::db::schema::$table::uploaded,
            crate::store::db::schema::$table::file_name,
            crate::store::db::schema::$table::file_size,
            crate::store::db::schema::$table::mimetype,
            crate::store::db::schema::$table::width,
            crate::store::db::schema::$table::height,
            crate::store::db::schema::$table::duration,
            crate::store::db::schema::$table::frame_rate,
            crate::store::db::schema::$table::bit_rate,
            crate::store::db::functions::media_metadata_columns!($table),
            crate::store::db::schema::$table::media_item,
            crate::store::db::schema::$table::needs_metadata,
            crate::store::db::schema::$table::stored,
        )
    };
    () => {
        crate::store::db::functions::media_file_columns!(media_file)
    };
}

macro_rules! media_field {
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
            crate::store::db::schema::media_item::public,
            (
                crate::store::db::functions::media_field!(filename),
                crate::store::db::functions::media_field!(title),
                crate::store::db::functions::media_field!(description),
                crate::store::db::functions::media_field!(label),
                crate::store::db::functions::media_field!(category),
                crate::store::db::functions::media_field!(location),
                crate::store::db::functions::media_field!(city),
                crate::store::db::functions::media_field!(state),
                crate::store::db::functions::media_field!(country),
                crate::store::db::functions::media_field!(make),
                crate::store::db::functions::media_field!(model),
                crate::store::db::functions::media_field!(lens),
                crate::store::db::functions::media_field!(photographer),
                crate::store::db::functions::media_field!(shutter_speed),
                crate::store::db::functions::media_field!(orientation),
                crate::store::db::functions::media_field!(iso),
                crate::store::db::functions::media_field!(rating),
                crate::store::db::functions::media_field!(longitude),
                crate::store::db::functions::media_field!(latitude),
                crate::store::db::functions::media_field!(altitude),
                crate::store::db::functions::media_field!(aperture),
                crate::store::db::functions::media_field!(focal_length),
                crate::store::db::functions::media_field!(taken),
            ),
            crate::store::db::schema::media_item::taken_zone,
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
                crate::store::db::schema::media_file_alternates::alternates.nullable(),
            )
                .nullable(),
        )
    };
}

macro_rules! media_view_tables {
    () => {
        crate::store::db::schema::media_item::table
            .left_outer_join(
                crate::store::db::schema::media_file::table
                    .on(crate::store::db::schema::media_item::media_file
                        .eq(crate::store::db::schema::media_file::id.nullable())),
            )
            .left_outer_join(
                crate::store::db::schema::media_file_alternates::table.on(
                    crate::store::db::schema::media_item::media_file
                        .eq(crate::store::db::schema::media_file_alternates::media_file.nullable()),
                ),
            )
    };
}

macro_rules! media_view {
    () => {
        crate::store::db::functions::media_view_tables!()
            .filter(crate::store::db::schema::media_item::deleted.eq(false))
            .order(crate::store::db::schema::media_item::datetime.desc())
    };
}

pub(crate) use media_field;
pub(crate) use media_file_columns;
pub(crate) use media_item_columns;
pub(crate) use media_metadata_columns;
pub(crate) use media_view;
pub(crate) use media_view_columns;
pub(crate) use media_view_tables;
