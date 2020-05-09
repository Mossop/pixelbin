import type { Catalog, Reference } from "./highlevel";
import request from "./request";
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
