import { DatabaseConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { from, insert } from "./queries";
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

export async function createUser(
  this: DatabaseConnection,
  user: Omit<Tables.User, "hadCatalog" | "verified">,
): Promise<UserWithoutPassword> {
  let results = await insert(this.knex, Table.User, {
    ...user,
    hadCatalog: false,
    verified: true,
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Error creating user.");
  }

  let { password, ...newUser } = intoAPITypes(results[0]);
  return newUser;
}
