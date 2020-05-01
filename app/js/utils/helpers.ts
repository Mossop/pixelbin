import { Draft } from "immer";

import { document } from "../environment";
import { StoreState } from "../store";

export function isLoggedIn(state: StoreState): boolean {
  return !!state.serverState.user;
}

export function uuid(): string {
  function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export function focus(id: string): void {
  let element = document.getElementById(id);
  if (element) {
    element.focus();

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.select();
    }
  }
}

export function createDraft<T>(item: T): Draft<T> {
  const mapEntries = <K, V>([key, value]: [K, V]): [Draft<K>, Draft<V>] =>
    [createDraft(key), createDraft(value)];

  if (item === null || item === undefined) {
    return item as Draft<T>;
  }

  if (Array.isArray(item)) {
    return item.map(createDraft) as unknown as Draft<T>;
  }

  if (item instanceof Set) {
    return new Set(Array.from(item.values(), createDraft)) as Draft<T>;
  }

  if (item instanceof Map) {
    return new Map(Array.from(item.entries(), mapEntries)) as Draft<T>;
  }

  if (typeof item == "object") {
    let draft = Object.create(Object.getPrototypeOf(item));
    for (let [key, value] of Object.entries(item)) {
      draft[key] = createDraft(value);
    }
    return draft as Draft<T>;
  }

  return item as Draft<T>;
}
