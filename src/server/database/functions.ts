import { Raw } from "knex";

import { DatabaseConnection } from "./connection";
import { Ref, bindingParam } from "./types";

export function coalesce(this: DatabaseConnection, refs: (string | Ref)[]): Raw {
  let bindings = refs.map(bindingParam);
  return this.raw(`COALESCE(${bindings.join(", ")})`, refs);
}
