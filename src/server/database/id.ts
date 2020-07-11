import { customAlphabet } from "nanoid/async";

const mediaNanoId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  25,
);
export async function mediaId(start: string): Promise<string> {
  return start + ":" + await mediaNanoId();
}

const nanoId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 10);
export async function uuid(start: string): Promise<string> {
  return start + ":" + await nanoId();
}
