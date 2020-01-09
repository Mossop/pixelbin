import { connect as reduxConnect } from "react-redux";

import { StoreState } from "../store/types";
import { ActionType } from "../store/actions";

// Merges two interfaces such that the properties of B replace those of A.
type Merged<A extends {}, B extends {}> = Omit<A, keyof A & keyof B> & B;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapStateToProps = (state: StoreState, ownProps?: any) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ActionCreator = (...args: any) => ActionType;
type MapDispatchToProps = { [key: string]: ActionCreator };

// Converts an action creator into a void function with the same parameters.
type IntoVoid<T extends ActionCreator> = (...a: Parameters<T>) => void;

export type DispatchProps<M extends MapDispatchToProps> = {
  [P in keyof M]: IntoVoid<M[P]>;
};

export type FromStateProps<F> =
  F extends MapStateToProps ? ReturnType<F> : {};

export type FromDispatchProps<F> =
  F extends MapDispatchToProps ? DispatchProps<F> : {};

// Generates the props for a component after mapStateToProps and mapDispatchToProps have done their work.
export type ComponentProps<
  PassedProps = {},
  mapStateToProps extends MapStateToProps | {} | undefined = {},
  mapDispatchToProps extends MapDispatchToProps | {} | undefined = {}
> = Merged<Merged<PassedProps, FromStateProps<mapStateToProps>>, FromDispatchProps<mapDispatchToProps>>;

// Derives the state for a react component.
type GetComponentState<C> = C extends React.Component<unknown, infer S> ? S : never;

// Derives the type that a constructor will create.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConstructorType<F extends new (...args: any) => any> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  F extends new (...args: any) => infer T
    ? T
    : never;

// A constructor for react components.
type ComponentConstructor<Props = {}, State = {}> = new (props: Props) => React.Component<Props, State>;

// The function created by react-redux's connect function. Essentially maps
// a constructor of AllProps to a constructor of PassedProps.
type Connector<PassedProps, AllProps> = <C extends ComponentConstructor<AllProps>>(component: C) => ComponentConstructor<PassedProps, GetComponentState<ConstructorType<C>>>;

// An override for react-redux's connect function to correct some type issues.
export function connect<
  PassedProps,
  mapStateToProps extends MapStateToProps = MapStateToProps,
  mapDispatchToProps extends MapDispatchToProps = MapDispatchToProps,
>(
  mapState: mapStateToProps | undefined,
  mapDispatch: mapDispatchToProps | undefined
): Connector<PassedProps, ComponentProps<PassedProps, mapStateToProps, mapDispatchToProps>> {
  return reduxConnect(mapState, mapDispatch) as unknown as Connector<PassedProps, ComponentProps<PassedProps, mapStateToProps, mapDispatchToProps>>;
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
