import { Dereferenced, ListsIn } from "pixelbin-object-model";

export type DbRecord<Table> = Dereferenced<Omit<Table, ListsIn<Table>>>;
