import { DatabaseConfig } from "./connection";
import { Table, TableRecord } from "./types";
export declare function getTestDatabaseConfig(): DatabaseConfig;
declare type Lifecycle = (cb: () => Promise<void>) => void;
interface Lifecycles {
    beforeAll: Lifecycle;
    beforeEach: Lifecycle;
    afterAll: Lifecycle;
}
export declare function buildTestDB({ beforeAll, beforeEach, afterAll, }: Lifecycles): void;
export declare function initDB(): Promise<void>;
export declare function resetDB(): Promise<void>;
export declare function destroyDB(): Promise<void>;
export declare type Seed = {
    [K in Table]?: TableRecord<K>[];
};
export declare function insertData(data: Seed): Promise<void>;
export declare const testData: {
    User: {
        email: string;
        fullname: string;
        hadCatalog: boolean;
        verified: boolean;
    }[];
    Catalog: {
        id: string;
        name: string;
    }[];
    Album: ({
        id: string;
        catalog: string;
        parent: null;
        stub: null;
        name: string;
    } | {
        id: string;
        catalog: string;
        parent: null;
        stub: string;
        name: string;
    } | {
        id: string;
        catalog: string;
        parent: string;
        stub: null;
        name: string;
    } | {
        id: string;
        catalog: string;
        parent: string;
        stub: string;
        name: string;
    })[];
    Tag: ({
        id: string;
        catalog: string;
        parent: null;
        name: string;
    } | {
        id: string;
        catalog: string;
        parent: string;
        name: string;
    })[];
    Person: {
        id: string;
        catalog: string;
        name: string;
    }[];
    User_Catalog: {
        catalog: string;
        user: string;
    }[];
};
export declare function insertTestData(): Promise<void>;
export {};
