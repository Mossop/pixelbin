import { connect as reduxConnect } from "react-redux";

import { ActionType } from "../store/actions";
import { StoreState } from "../store/types";

// Merges two interfaces such that the properties of B replace those of A.
type Merged<A extends {}, B extends {}> = Pick<A, Exclude<keyof A, keyof B>> & B;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapStateToProps<O> = (state: StoreState, ownProps?: O) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionCreator = (...args: any) => ActionType;
type MapDispatchToProps = { [key: string]: ActionCreator };

// Converts an action creator into a void function with the same parameters.
type IntoVoid<T extends ActionCreator> = (...a: Parameters<T>) => void;

export type DispatchProps<M extends MapDispatchToProps> = {
  [P in keyof M]: IntoVoid<M[P]>;
};

export type FromStateProps<F> =
  F extends MapStateToProps<unknown> ? ReturnType<F> : {};

export type FromDispatchProps<F> =
  F extends MapDispatchToProps ? DispatchProps<F> : {};

// Generates the props for a component after mapStateToProps and mapDispatchToProps have done their work.
export type ComponentProps<
  P = {},
  S extends MapStateToProps<P> | {} | undefined = {},
  D extends MapDispatchToProps | {} | undefined = {}
> = Merged<Merged<P, FromStateProps<S>>, FromDispatchProps<D>>;

// A constructor for react components.
type ComponentConstructor<Props = {}> = new (props: Props) => React.Component<Props>;

// The function created by react-redux's connect function. Essentially maps
// a constructor of AllProps to a constructor of PassedProps.
type Connector<PassedProps, AllProps> = (component: ComponentConstructor<AllProps>) => ComponentConstructor<PassedProps>;

type ConnectShim<P = {}> = <
  S extends MapStateToProps<P> | undefined,
  D extends MapDispatchToProps | undefined,
>(mapStateToProps?: S, mapDispatchToProps?: D) => Connector<P, ComponentProps<P, S, D>>;

// An override for react-redux's connect function to correct some type issues.
export function connect<P = never>(): ConnectShim<P> {
  return <
    S extends MapStateToProps<P> | undefined,
    D extends MapDispatchToProps | undefined,
  >(mapStateToProps?: S, mapDispatchToProps?: D): Connector<P, ComponentProps<P, S, D>> => {
    return reduxConnect(mapStateToProps, mapDispatchToProps) as unknown as Connector<P, ComponentProps<P, S, D>>;
  };
}

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

export function styleProps<P extends StyleProps>(props: P, additional: StyleProps = {}): ElementStyleProps {
  const asArray: ((i: undefined | string | string[]) => string[]) = (i: undefined | string | string[]): string[] => {
    if (i === undefined) {
      return [];
    } else if (Array.isArray(i)) {
      return i;
    } else {
      return [i];
    }
  };

  let result: ElementStyleProps = {
    id: props.id || additional.id,
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

export function fieldProps<P extends FieldProps>(props: P, additional: StyleProps = {}): ElementFieldProps {
  let result: ElementFieldProps = {
    ...styleProps(props, additional),
  };

  if (props.disabled) {
    result.disabled = true;
  }

  return result;
}
