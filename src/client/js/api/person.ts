import { Api } from "../../../model";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import { personIntoState, PersonState } from "./types";

export async function createPerson(
  catalog: Reference<Catalog>,
  name: string,
): Promise<PersonState> {
  let result = await request(Api.Method.PersonCreate, {
    catalog: catalog.id,
    name,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return personIntoState(result);
}
