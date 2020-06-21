import * as Db from "pixelbin-database";
import { User } from "pixelbin-object-model";

import { CatalogCreateRequest, Catalog } from ".";
import { AppContext } from "../app";
import { ensureAuthenticated } from "../auth";

export const createCatalog = ensureAuthenticated(
  async (ctx: AppContext, user: User, data: CatalogCreateRequest): Promise<Catalog> => {
    return Db.createCatalog(user.email, data.name);
  },
);
