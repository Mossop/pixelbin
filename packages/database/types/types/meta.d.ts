import { Dereferenced, ListsIn } from "pixelbin-object-model";
export declare type DbRecord<Table> = Dereferenced<Omit<Table, ListsIn<Table>>>;
