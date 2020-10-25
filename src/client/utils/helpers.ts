import { Draft } from "immer";

import { document } from "../environment";
import { StoreState } from "../store/types";

export function promiseEvent(
  object: EventTarget,
  event: string,
  timeout: number = 5000,
): Promise<Event> {
  return new Promise((resolve: (event: Event) => void, reject: () => void): void => {
    setTimeout(reject, timeout);

    object.addEventListener(event, resolve, { once: true });
  });
}

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
  let mapEntries = <K, V>([key, value]: [K, V]): [Draft<K>, Draft<V>] =>
    [createDraft(key), createDraft(value)];

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
    let draft: T = Object.create(Object.getPrototypeOf(item)) as T;
    for (let [key, value] of Object.entries(item)) {
      draft[key] = createDraft(value);
    }
    return draft as Draft<T>;
  }

  return item as Draft<T>;
}
