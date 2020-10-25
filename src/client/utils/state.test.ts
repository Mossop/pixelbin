import { ObjectState, wrapState } from "./state";

test("state", () => {
  interface State {
    a: number;
    b: string;
    c: boolean;
    d: {
      a: string;
      b: boolean;
      c: {
        a: boolean;
      }
    }
  }

  let state: State = {
    a: 5,
    b: "hello",
    c: true,
    d: {
      a: "boo",
      b: false,
      c: {
        a: true,
      },
    },
  };

  const setter = (val: State): void => {
    state = val;
  };
  const wrap = (): ObjectState<State> => wrapState(state, setter);

  let wrapped = wrap();
  expect(wrap()).toBe(wrapped);

  expect(wrapped.value).toBe(state);
  expect(wrapped.a.value).toBe(5);
  expect(wrapped.b.value).toBe("hello");
  expect(wrapped.a).toBe(wrapped.a);
  expect(wrapped.d.value).toBe(wrapped.d.value);
  expect(wrapped.d.value).toBe(state.d);

  let original = state;
  wrapped.a.set(7);
  let newWrapped = wrap();
  expect(newWrapped).not.toBe(wrapped);

  expect(newWrapped.a.value).toBe(7);
  expect(newWrapped.value).toBe(state);
  expect(state).not.toBe(original);
  original.a = 7;
  expect(newWrapped.value).toEqual(original);

  expect(newWrapped.d.a.value).toBe("boo");
  expect(newWrapped.d.a).toBe(newWrapped.d.a);

  newWrapped.d.a.set("baz");
  original.d.a = "baz";
  expect(state).toEqual(original);

  wrapped = wrap();
  expect(wrapped.d.a.value).toBe("baz");

  expect(wrapped.d.c.a).toBe(wrapped.d.c.a);
  wrapped.d.c.a.set(false);
  original.d.c.a = false;
  expect(state).toEqual(original);
});
