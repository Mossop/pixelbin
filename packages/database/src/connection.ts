import Knex from "knex";
import { defer, Deferred } from "pixelbin-utils";

interface ExtendedKnex extends Knex {
  userParams: {
    schema?: string;
  }
}

const deferredKnex: Deferred<ExtendedKnex> = defer();

export function connect(config: Knex.Config): ExtendedKnex {
  let knex = Knex(config) as ExtendedKnex;
  deferredKnex.resolve(knex);
  return knex;
}

export const connection = deferredKnex.promise;
