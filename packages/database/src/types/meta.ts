export interface IdTable<K = string> {
  id: K;
}

// A fake type, nver really used.
export type ForeignKey<Table, Column = "id"> = Column extends keyof Table ? {
  table: Table,
  column: Column,
} : never;

export type ForeignKeyType<T> =
  T extends ForeignKey<infer Table, infer Column> ?
    Column extends keyof Table ?
      Table[Column] :
      never :
    T;

export type RecordFor<Table> = {
  [Column in keyof Table]: ForeignKeyType<Table[Column]>;
};
