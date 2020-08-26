import { Api } from "../../../model";
import { request } from "./api";
import type { Catalog, Reference } from "./highlevel";
import { tagIntoState, TagState } from "./types";

export async function findTag(
  catalog: Reference<Catalog>,
  path: string[],
): Promise<readonly TagState[]> {
  let tags = await request(Api.Method.TagFind, {
    catalog: catalog.id,
    tags: path,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return tags.map(tagIntoState);
}
