import { Method } from "../../model";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import type { PersonState } from "./types";
import { personIntoState } from "./types";

export async function createPerson(
  catalog: Reference<Catalog>,
  name: string,
): Promise<PersonState> {
  let result = await request(Method.PersonCreate, {
    catalog: catalog.id,
    name,
  });

  return personIntoState(result);
}
