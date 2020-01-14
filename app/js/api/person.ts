import { request } from "./api";
import { ApiMethod, PersonCreateData, PersonData } from "./types";

export async function createPerson(person: PersonCreateData): Promise<PersonData> {
  return request(ApiMethod.PersonCreate, person);
}
