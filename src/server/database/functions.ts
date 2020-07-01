import Knex, { Raw } from "knex";

import { Ref, isRef } from "./types";

export function coalesce(knex: Knex, refs: (string | Ref)[]): Raw {
  let bindings = refs.map((val: string | Ref): string => isRef(val) ? "??" : "?");
  return knex.raw(`COALESCE(${bindings.join(", ")})`, refs);
}
