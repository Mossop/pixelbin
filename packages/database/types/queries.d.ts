import Knex from "knex";
import { Table, TableRecord } from "./types";
export declare function from<T extends Table, TRecord extends {} = any, TResult = unknown[]>(knex: Knex.QueryInterface<TRecord, TResult>, tableName: T): Knex.QueryBuilder<import("./types").TableMapping[T], (TResult extends (infer M)[] ? M : TResult) extends {
    _base: any;
    _hasSelection: any;
    _keys: any;
    _aliases: any;
    _single: any;
    _intersectProps: any;
    _unionProps: any;
} ? TResult extends any[] ? ({
    _base: any;
    _hasSelection: any;
    _keys: any;
    _aliases: any;
    _single: any;
    _intersectProps: any;
    _unionProps: any;
} & (TResult extends (infer M)[] ? M : TResult) extends {
    _base: any;
    _hasSelection: infer THasSelect;
    _keys: infer TKeys;
    _aliases: infer TAliasMapping;
    _single: infer TSingle;
    _intersectProps: infer TIntersectProps;
    _unionProps: infer TUnionProps;
} ? {
    _base: import("./types").TableMapping[T];
    _hasSelection: THasSelect;
    _keys: TKeys;
    _aliases: TAliasMapping;
    _single: TSingle;
    _intersectProps: TIntersectProps;
    _unionProps: TUnionProps;
} : {
    _base: import("./types").TableMapping[T];
    _hasSelection: false;
    _keys: never;
    _aliases: {};
    _single: false;
    _intersectProps: {};
    _unionProps: never;
})[] : {
    _base: any;
    _hasSelection: any;
    _keys: any;
    _aliases: any;
    _single: any;
    _intersectProps: any;
    _unionProps: any;
} & (TResult extends (infer M)[] ? M : TResult) extends {
    _base: any;
    _hasSelection: infer THasSelect;
    _keys: infer TKeys;
    _aliases: infer TAliasMapping;
    _single: infer TSingle;
    _intersectProps: infer TIntersectProps;
    _unionProps: infer TUnionProps;
} ? {
    _base: import("./types").TableMapping[T];
    _hasSelection: THasSelect;
    _keys: TKeys;
    _aliases: TAliasMapping;
    _single: TSingle;
    _intersectProps: TIntersectProps;
    _unionProps: TUnionProps;
} : {
    _base: import("./types").TableMapping[T];
    _hasSelection: false;
    _keys: never;
    _aliases: {};
    _single: false;
    _intersectProps: {};
    _unionProps: never;
} : unknown extends (TResult extends (infer M)[] ? M : TResult) ? TResult extends any[] ? ((TResult extends (infer M)[] ? M : TResult) extends {
    _base: any;
    _hasSelection: infer THasSelect;
    _keys: infer TKeys;
    _aliases: infer TAliasMapping;
    _single: infer TSingle;
    _intersectProps: infer TIntersectProps;
    _unionProps: infer TUnionProps;
} ? {
    _base: import("./types").TableMapping[T];
    _hasSelection: THasSelect;
    _keys: TKeys;
    _aliases: TAliasMapping;
    _single: TSingle;
    _intersectProps: TIntersectProps;
    _unionProps: TUnionProps;
} : {
    _base: import("./types").TableMapping[T];
    _hasSelection: false;
    _keys: never;
    _aliases: {};
    _single: false;
    _intersectProps: {};
    _unionProps: never;
})[] : (TResult extends (infer M)[] ? M : TResult) extends {
    _base: any;
    _hasSelection: infer THasSelect;
    _keys: infer TKeys;
    _aliases: infer TAliasMapping;
    _single: infer TSingle;
    _intersectProps: infer TIntersectProps;
    _unionProps: infer TUnionProps;
} ? {
    _base: import("./types").TableMapping[T];
    _hasSelection: THasSelect;
    _keys: TKeys;
    _aliases: TAliasMapping;
    _single: TSingle;
    _intersectProps: TIntersectProps;
    _unionProps: TUnionProps;
} : {
    _base: import("./types").TableMapping[T];
    _hasSelection: false;
    _keys: never;
    _aliases: {};
    _single: false;
    _intersectProps: {};
    _unionProps: never;
} : TResult>;
export declare const into: typeof from;
export declare const table: typeof from;
export declare function insert<T extends Table>(table: T, data: TableRecord<T> | TableRecord<T>[]): Promise<void>;
export declare function update<T extends Table>(table: T, where: Partial<TableRecord<T>>, update: Partial<TableRecord<T>>): Promise<void>;
export declare function drop<T extends Table>(table: T, where: Partial<TableRecord<T>>): Promise<void>;
export declare function withChildren<T extends Table.Tag | Table.Album>(table: T, queryBuilder: Knex.QueryBuilder<TableRecord<T>>): Promise<Knex.QueryBuilder<TableRecord<T>, TableRecord<T>[]>>;
