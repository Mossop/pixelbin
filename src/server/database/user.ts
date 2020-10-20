import { hash as bcryptHash, compare as bcryptCompare } from "bcrypt";

import { now } from "../../utils";
import { DatabaseConnection, UserScopedConnection } from "./connection";
import { DatabaseError, DatabaseErrorCode } from "./error";
import { from, insert, update } from "./queries";
import { Tables, Table, intoAPITypes } from "./types";

type UserWithoutPassword = Omit<Tables.User, "password" | "lastLogin">;
export async function loginUser(
  this: DatabaseConnection,
  email: Tables.User["email"],
  password: Tables.User["password"],
): Promise<UserWithoutPassword | undefined> {
  let users = await from(this.knex, Table.User).where({
    email,
  }).select("*");

  if (users.length != 1) {
    return undefined;
  }

  if (await bcryptCompare(password, users[0].password)) {
    await update(
      Table.User,
      this.knex.where({
        email,
      }),
      {
        lastLogin: now(),
      },
    );

    let { password, lastLogin, ...rest } = users[0];
    return intoAPITypes(rest);
  }

  return undefined;
}

export async function createUser(
  this: DatabaseConnection,
  user: Omit<Tables.User, "created" | "lastLogin" | "verified">,
): Promise<UserWithoutPassword> {
  let hashed = await bcryptHash(user.password, 12);

  let results = await insert(this.knex, Table.User, {
    ...user,
    password: hashed,
    created: now(),
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

export async function getUser(
  this: UserScopedConnection,
): Promise<UserWithoutPassword> {
  let users = await from(this.knex, Table.User).where({
    email: this.user,
  }).select("*");

  let { password, lastLogin, ...rest } = users[0];
  return intoAPITypes(rest);
}
