import { UIComponentProps } from "../utils/uicontext";

export interface DefaultProps {
  id?: string;
  style?: object;
  className?: string | string[];
}

type Final<P> = P & {
  className?: string;
};

export function defaultProps<P extends DefaultProps>(props: P, additional: DefaultProps = {}): Final<DefaultProps> {
  const asArray: ((i: undefined | string | string[]) => string[]) = (i: undefined | string | string[]): string[] => {
    if (i === undefined) {
      return [];
    } else if (Array.isArray(i)) {
      return i;
    } else {
      return [i];
    }
  };

  const { id, style, className } = props;
  return {
    id: id || additional.id,
    style: Object.assign({}, additional.style, style),
    className: asArray(className).concat(asArray(additional.className)).join(" "),
  };
}

export type FieldProps = {
  disabled?: boolean;
} & DefaultProps;

export function fieldProps<P extends FieldProps>(props: P, additional: DefaultProps = {}): Final<FieldProps> {
  return {
    ...defaultProps(props, additional),
    disabled: props.disabled,
  };
}

export type UIProps = FieldProps & UIComponentProps;

export function uiProps<P extends UIProps>(props: P, additional: DefaultProps = {}): Final<UIProps> {
  return {
    ...fieldProps(props, additional),
    uiPath: props.uiPath,
  };
}
