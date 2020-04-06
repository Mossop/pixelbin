export interface StyleProps {
  id?: string;
  style?: React.CSSProperties;
  className?: string | string[];
}

interface ElementStyleProps {
  id?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function styleProps<P extends StyleProps>(
  props: P,
  additional: StyleProps = {},
): ElementStyleProps {
  const asArray = (i: undefined | string | string[]): string[] => {
    if (i === undefined) {
      return [];
    } else if (Array.isArray(i)) {
      return i;
    } else {
      return [i];
    }
  };

  let result: ElementStyleProps = {
    id: props.id ?? additional.id,
    style: Object.assign({}, additional.style, props.style),
    className: asArray(props.className).concat(asArray(additional.className)).join(" ").trim(),
  };

  if (!result.id) {
    delete result.id;
  }

  if (result.style && Object.keys(result.style).length === 0) {
    delete result.style;
  }

  if (result.className === "") {
    delete result.className;
  }

  return result;
}

export type FieldProps = {
  disabled?: boolean;
} & StyleProps;

type ElementFieldProps = {
  disabled?: boolean;
} & ElementStyleProps;

export function fieldProps<P extends FieldProps>(
  props: P,
  additional: StyleProps = {},
): ElementFieldProps {
  let result: ElementFieldProps = {
    ...styleProps(props, additional),
  };

  if (props.disabled) {
    result.disabled = true;
  }

  return result;
}
