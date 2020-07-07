import moment from "moment";

import { connection } from "./connection";
import { from } from "./queries";
import { Table, Tables } from "./types";

export async function getMedia(id: string): Promise<Tables.Media | null> {
  let results = await from(await connection, Table.Media).where({ id }).select("*");

  if (results.length == 0) {
    return null;
  } else if (results.length != 1) {
    throw new Error("Found multiple matching media records.");
  } else {
    let result: Tables.Media = {
      ...results[0],
      created: moment.tz(results[0].created, "UTC"),
    };
    return result;
  }
}
