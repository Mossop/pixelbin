import { DatabaseConnection } from "./connection";
import { from } from "./queries";
import { Tables, Table, intoAPITypes } from "./types";

type UserWithoutPassword = Omit<Tables.User, "password">;
export async function getUser(
  this: DatabaseConnection,
  email: Tables.User["email"],
  password: Tables.User["password"],
): Promise<UserWithoutPassword | undefined> {
  let result = await from(this.knex, Table.User).where({
    email,
    password,
  }).first();

  if (result) {
    let { password, ...user } = result;
    return intoAPITypes(user);
  }
  return result;
}
