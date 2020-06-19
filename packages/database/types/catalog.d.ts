import { Tables } from "./types";
export declare function listCatalogs(user: string): Promise<Tables.Catalog[]>;
export declare function listAlbums(user: string): Promise<Tables.Album[]>;
export declare function listPeople(user: string): Promise<Tables.Person[]>;
export declare function listTags(user: string): Promise<Tables.Tag[]>;
