import { CatalogCreateRequest, Catalog } from ".";
import { AppContext } from "../app";

export function createCatalog(ctx: AppContext, data: CatalogCreateRequest): Promise<Catalog> {
  throw new Error("foo");
}
