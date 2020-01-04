import { exceptionAction } from "../store/actions";
import store from "../store/store";

export enum ErrorCode {
  NotLoggedIn,
  UnknownCatalog,
  UnknownAlbum,
  DecodeError,
}

export function exception(code: ErrorCode, message?: string): never {
  store.dispatch(exceptionAction(code));
  if (message) {
    throw new Error(`Internal error ${String(code).padStart(3, "0")}: ${message}`);
  } else {
    throw new Error(`Internal error ${String(code).padStart(3, "0")}`);
  }
}
