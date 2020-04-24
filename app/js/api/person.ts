import { ApiMethod } from ".";
import type { PersonData } from ".";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";

export async function createPerson(
  catalog: Reference<Catalog>,
  name: string,
): Promise<PersonData> {
  return request(ApiMethod.PersonCreate, {
    catalog,
    name,
  });
}
