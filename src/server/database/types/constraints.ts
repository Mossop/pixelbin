import Knex from "knex";

import { Table } from ".";
import { columnFor } from "./meta";

export function nameConstraint(
  knex: Knex,
  target: Table,
  parent: string | null = "parent",
): Knex.Raw {
  let match: string;
  if (!parent) {
    parent = "";
    match = ":target:";
  } else {
    match = "(COALESCE(:parent:, :target:))";
  }

  return knex.raw(`(${match}, (LOWER(:name:)))`, {
    parent,
    target: columnFor(target),
    name: "name",
  });
}
