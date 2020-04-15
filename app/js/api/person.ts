import { request } from "./api";
import { Catalog, Reference } from "./highlevel";
import { ApiMethod, PersonData } from "./types";

export async function createPerson(
  catalog: Reference<Catalog>,
  name: string,
): Promise<PersonData> {
  return request(ApiMethod.PersonCreate, {
    catalog,
    name,
  });
}
