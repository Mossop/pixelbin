// eslint-disable-next-line @typescript-eslint/ban-types
function canWeakRef(val: unknown): val is {} {
  // @ts-ignore
  return val && (typeof val == "function" || typeof val == "object");
}

class WrappedMap {
  // eslint-disable-next-line @typescript-eslint/ban-types
  private readonly weakRefs: WeakMap<{}, WrappedMap> = new WeakMap();
  private readonly refs: Map<unknown, WrappedMap> = new Map();

  public get(val: unknown): WrappedMap {
    if (canWeakRef(val)) {
      let result = this.weakRefs.get(val);
      if (!result) {
        result = new WrappedMap();
        this.weakRefs.set(val, result);
      }
      return result;
    }

    let result = this.refs.get(val);
    if (!result) {
      result = new WrappedMap();
      this.refs.set(val, result);
    }
    return result;
  }
}

export function memoized<R, A extends unknown[]>(builder: (...args: A) => R): (...args: A) => R {
  let values = new WeakMap<WrappedMap, R>();
  let memos = new WrappedMap();

  return (...args: A): R => {
    let inner = memos;
    for (let val of args) {
      inner = inner.get(val);
    }

    if (values.has(inner)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return values.get(inner)!;
    }

    let result = builder(...args);
    values.set(inner, result);
    return result;
  };
}
