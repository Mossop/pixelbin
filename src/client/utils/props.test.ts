import { styleProps, fieldProps } from "./props";

test("styleProps", (): void => {
  expect(styleProps({
    id: "fooid",
  })).toEqual({
    id: "fooid",
  });

  expect(styleProps({ className: "foo" })).toEqual({ className: "foo" });
  expect(styleProps({ className: ["foo", "bar"] })).toEqual({ className: "foo bar" });
  expect(styleProps({ className: "foo bar" })).toEqual({ className: "foo bar" });

  expect(styleProps({ }, {
    id: "bar",
  })).toEqual({ id: "bar" });

  expect(styleProps({
    id: "foo",
  }, {
    id: "bar",
  })).toEqual({ id: "foo" });

  expect(styleProps({
    style: {
      width: "100px",
      height: "200px",
    },
  })).toEqual({
    style: {
      width: "100px",
      height: "200px",
    },
  });

  expect(styleProps({ }, {
    style: {
      width: "100px",
      height: "200px",
    },
  })).toEqual({
    style: {
      width: "100px",
      height: "200px",
    },
  });

  expect(styleProps({
    style: {},
  }, {
    style: {
      width: "100px",
      height: "200px",
    },
  })).toEqual({
    style: {
      width: "100px",
      height: "200px",
    },
  });

  expect(styleProps({
    style: {
      top: 0,
      height: "300px",
    },
  }, {
    style: {
      width: "100px",
      height: "200px",
    },
  })).toEqual({
    style: {
      top: 0,
      width: "100px",
      height: "300px",
    },
  });
});

test("fieldProps", (): void => {
  expect(fieldProps({
    style: {
      top: 0,
      height: "300px",
    },
  }, {
    style: {
      width: "100px",
      height: "200px",
    },
  })).toEqual({
    disabled: false,
    style: {
      top: 0,
      width: "100px",
      height: "300px",
    },
  });

  expect(fieldProps({
    disabled: false,
    style: {
      top: 0,
      height: "300px",
    },
  }, {
    style: {
      width: "100px",
      height: "200px",
    },
  })).toEqual({
    disabled: false,
    style: {
      top: 0,
      width: "100px",
      height: "300px",
    },
  });

  expect(fieldProps({
    disabled: true,
    style: {
      top: 0,
      height: "300px",
    },
  }, {
    style: {
      width: "100px",
      height: "200px",
    },
  })).toEqual({
    disabled: true,
    style: {
      top: 0,
      width: "100px",
      height: "300px",
    },
  });

  expect(fieldProps({
    disabled: true,
    style: {
      top: 0,
      height: "300px",
    },
  })).toEqual({
    disabled: true,
    style: {
      top: 0,
      height: "300px",
    },
  });
});
