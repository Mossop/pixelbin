import { buildJSONBody, request } from "./api";
import { Person, Catalog, PersonDecoder } from "./types";
import { intoId, MapId } from "../utils/maps";

export async function createPerson(catalog: MapId<Catalog>, name: string): Promise<Person> {
  return request({
    url: "person/create",
    method: "PUT",
    body: buildJSONBody({
      catalog: intoId(catalog),
      fullname: name,
    }),
    decoder: PersonDecoder,
  });
}
