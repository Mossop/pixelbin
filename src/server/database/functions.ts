import Knex, { Raw } from "knex";

import { Ref, bindingParam } from "./types";

export function coalesce(knex: Knex, refs: (string | Ref)[]): Raw {
  let bindings = refs.map(bindingParam);
  return knex.raw(`COALESCE(${bindings.join(", ")})`, refs);
}
