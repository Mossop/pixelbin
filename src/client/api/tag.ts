import { Method } from "../../model";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import type { TagState } from "./types";
import { tagIntoState } from "./types";

export async function findTag(
  catalog: Reference<Catalog>,
  path: string[],
): Promise<readonly TagState[]> {
  let tags = await request(Method.TagFind, {
    catalog: catalog.id,
    tags: path,
  });

  return tags.map(tagIntoState);
}
