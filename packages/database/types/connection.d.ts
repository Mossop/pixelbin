import Knex from "knex";
export interface DatabaseConfig {
    username: string;
    password: string;
    host: string;
    port?: number;
    database: string;
}
interface ExtendedKnex extends Knex {
    userParams: {
        schema?: string;
    };
}
export declare function connect(config: DatabaseConfig): ExtendedKnex;
export declare const connection: Promise<ExtendedKnex>;
export {};
