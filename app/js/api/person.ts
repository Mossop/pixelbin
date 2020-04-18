import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import { ApiMethod } from "./types";
import type { PersonData } from "./types";

export async function createPerson(
  catalog: Reference<Catalog>,
  name: string,
): Promise<PersonData> {
  return request(ApiMethod.PersonCreate, {
    catalog,
    name,
  });
}
