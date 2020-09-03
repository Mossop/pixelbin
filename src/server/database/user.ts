import moment from "moment-timezone";

import { DatabaseConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { from, insert, update } from "./queries";
import { Tables, Table, intoAPITypes } from "./types";

type UserWithoutPassword = Omit<Tables.User, "password" | "lastLogin">;
export async function loginUser(
  this: DatabaseConnection,
  email: Tables.User["email"],
  password: Tables.User["password"],
): Promise<UserWithoutPassword | undefined> {
  let users = await update(
    Table.User,
    this.knex.where({
      email,
      password,
    }),
    {
      lastLogin: moment(),
    },
  ).returning("*");

  if (users.length == 1) {
    let { password, lastLogin, ...rest } = users[0];
    return intoAPITypes(rest);
  }
  return undefined;
}

export async function createUser(
  this: DatabaseConnection,
  user: Omit<Tables.User, "created" | "lastLogin" | "verified">,
): Promise<UserWithoutPassword> {
  let results = await insert(this.knex, Table.User, {
    ...user,
    created: moment(),
    lastLogin: null,
    verified: true,
  }).returning("*");

  if (!results.length) {
    throw new DatabaseError(DatabaseErrorCode.UnknownError, "Error creating user.");
  }

  let { password, lastLogin, ...newUser } = intoAPITypes(results[0]);
  return newUser;
}

export async function listUsers(
  this: DatabaseConnection,
): Promise<Omit<Tables.User, "password">[]> {
  let users = await from(this.knex, Table.User).select("*");
  return users.map((user: Tables.User): Omit<Tables.User, "password"> => {
    let {
      password,
      ...rest
    } = user;
    return rest;
  });
}
