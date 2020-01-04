import { exceptionAction } from "../store/actions";
import store from "../store/store";

export enum ErrorCode {
  NotLoggedIn,
  UnknownCatalog,
  UnknownAlbum,
}

export function exception(code: ErrorCode): never {
  store.dispatch(exceptionAction(code));
  throw new Error(`Internal error ${String(code).padStart(3, "0")}`);
}
