import type { Draft } from "immer";

import { Method } from "../../model";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import { refId } from "./highlevel";
import type { PersonState } from "./types";
import { personIntoState } from "./types";

export async function createPerson(
  catalog: Reference<Catalog>,
  person: Omit<PersonState, "id" | "catalog">,
): Promise<Draft<PersonState>> {
  let result = await request(Method.PersonCreate, {
    catalog: refId(catalog),
    person,
  });

  return personIntoState(result);
}
