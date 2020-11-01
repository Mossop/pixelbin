import type { Draft } from "immer";

import { Method } from "../../model";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import type { TagState } from "./types";
import { tagIntoState } from "./types";

export async function findTag(
  catalog: Reference<Catalog>,
  names: string[],
): Promise<readonly Draft<TagState>[]> {
  let tags = await request(Method.TagFind, {
    catalog: catalog.id,
    names,
  });

  return tags.map(tagIntoState);
}
