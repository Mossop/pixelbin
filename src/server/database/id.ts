import { customAlphabet } from "nanoid/async";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const mediaNanoId = customAlphabet(ALPHABET, 25);
export async function mediaId(): Promise<string> {
  return `M:${await mediaNanoId()}`;
}

export async function searchId(): Promise<string> {
  return `S:${await mediaNanoId()}`;
}

const nanoId = customAlphabet(ALPHABET, 10);
export async function uuid(start: string): Promise<string> {
  return start + ":" + await nanoId();
}
