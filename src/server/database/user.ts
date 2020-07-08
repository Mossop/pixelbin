import { connection } from "./connection";
import { from } from "./queries";
import { Tables, Table } from "./types";

type UserWithoutPassword = Omit<Tables.User, "password">;
export async function getUser(
  email: string,
  password: string,
): Promise<UserWithoutPassword | undefined> {
  let knex = await connection;
  let result = await from(knex, Table.User).where({
    email,
    password,
  }).first();

  if (result) {
    let { password, ...user } = result;
    return user;
  }
  return result;
}
