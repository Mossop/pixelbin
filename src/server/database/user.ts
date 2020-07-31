import { connection } from "./connection";
import { from } from "./queries";
import { Tables, Table, DBAPI, intoAPITypes } from "./types";

type UserWithoutPassword = Omit<Tables.User, "password">;
export async function getUser(
  email: DBAPI<Tables.User>["email"],
  password: DBAPI<Tables.User>["password"],
): Promise<DBAPI<UserWithoutPassword> | undefined> {
  let knex = await connection;
  let result = await from(knex, Table.User).where({
    email,
    password,
  }).first();

  if (result) {
    let { password, ...user } = result;
    return intoAPITypes(user);
  }
  return result;
}
