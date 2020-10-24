export function memoized<R, A extends unknown[]>(builder: (...args: A) => R): (...args: A) => R {
  const values = new Map<Map<unknown, unknown>, R>();
  const memos = new Map<unknown, unknown>();

  return (...args: A): R => {
    let params = [...args] as A;
    let inner: Map<unknown, unknown> = memos;
    while (args.length && inner.has(args[0])) {
      inner = inner.get(args.shift()) as Map<unknown, unknown>;
    }

    if (!args.length && values.has(inner)) {
      return values.get(inner) as R;
    }

    while (args.length) {
      let next = new Map();
      inner.set(args.shift(), next);
      inner = next;
    }

    let result = builder(...params);
    values.set(inner, result);
    return result;
  };
}
