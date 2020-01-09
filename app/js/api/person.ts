import { buildJSONBody, request } from "./api";
import { PersonData, PersonDecoder, CreateData } from "./types";

export async function createPerson(person: CreateData<PersonData>): Promise<PersonData> {
  return request({
    url: "person/create",
    method: "PUT",
    body: buildJSONBody(person),
    decoder: PersonDecoder,
  });
}
