/* eslint-disable @typescript-eslint/no-explicit-any */
import { Deed } from "deeds/immer";
import React from "react";
import { connect as reduxConnect } from "react-redux";

import { StoreState } from "./types";

// Merges two interfaces such that the properties of B replace those of A.
type Merged<A extends {}, B extends {}> = Omit<A, keyof B> & B;

// A React component constructor.
export type ReactConstructor<T, S = {}> = new (props: T) => React.Component<T, S>;
export type PropsFor<T> =
  T extends React.Component<infer P> ? P :
    T extends ReactConstructor<infer P> ? P :
      never;

// Dispatch and action types.
type Dispatch = (action: Deed) => void;
type ActionCreator = (...args: unknown[]) => Deed;

// mapStateToProps.
export type MapStateToProps<PP extends {} = any, SP extends {} = any> = (state: StoreState, ownProps?: PP) => SP;
export type StateProps<T> = T extends MapStateToProps<any, infer SP> ? SP : {};
export type MergedMapStateToProps<PP, A, B> = MapStateToProps<PP, Merged<StateProps<A>, StateProps<B>>>;
export function mergeMapStateToProps<
  PP,
  A extends MapStateToProps<PP> | undefined,
  B extends MapStateToProps<PP> | undefined
>(a: A, b: B): MergedMapStateToProps<PP, A, B> {
  return (state: StoreState, ownProps: PP): Merged<StateProps<A>, StateProps<B>> => {
    let aProps: StateProps<A> = a ? a(state, ownProps) : {};
    let bProps: StateProps<B> = b ? b(state, ownProps) : {};
    return {
      ...aProps,
      ...bProps,
    };
  };
}

// mapDispatchToProps.
type MapDispatchToPropsObject = { [key: string]: ActionCreator };
type MapDispatchToPropsFunction<PP extends {}, DP extends {}> = (dispatch: Dispatch, ownProps?: PP) => DP;
export type MapDispatchToProps<PP = any, DP = any> = MapDispatchToPropsObject | MapDispatchToPropsFunction<PP, DP>;
type DispatchProps<T> =
  T extends MapDispatchToPropsFunction<any, infer DP> ? DP :
    T extends MapDispatchToPropsObject ? { [K in keyof T]: (...args: Parameters<T[K]>) => void } :
      {};

// Generates the props for a component after mapStateToProps and mapDispatchToProps have done their work.
export type ComponentProps<
  PP extends {} = {},
  SP extends MapStateToProps<PP> | {} | undefined = {},
  DP extends MapDispatchToProps<PP> | {} | undefined = {}
> = Merged<Merged<PP, StateProps<SP>>, DispatchProps<DP>>;

type Connector<PP> = <
  SP extends MapStateToProps<PP> | undefined,
  DP extends MapDispatchToProps<PP> | undefined,
>(component: ReactConstructor<Merged<Merged<PP, StateProps<SP>>, DispatchProps<DP>>>, mapStateToProps?: SP, mapDispatchToProps?: DP) => ReactConstructor<PP>;

export function connect<PP = {}>(): Connector<PP> {
  return <
    SP extends MapStateToProps<PP> | undefined,
    DP extends MapDispatchToProps<PP> | undefined,
  >(component: ReactConstructor<ComponentProps<PP, SP, DP>>, mapStateToProps?: SP, mapDispatchToProps?: DP): ReactConstructor<PP> => {
    // @ts-ignore
    return reduxConnect(mapStateToProps, mapDispatchToProps)(component);
  };
}

type Connect = <PP = {}>() => Connector<PP>;

export function mergedConnect<BSP extends MapStateToProps | undefined>(baseMapStateToProps?: BSP): Connect {
  return <PP>(): Connector<PP> => {
    return <
      SP extends MapStateToProps<PP> | undefined,
      DP extends MapDispatchToProps<PP> | undefined,
    >(component: ReactConstructor<ComponentProps<PP, SP, DP>>, mapStateToProps?: SP, mapDispatchToProps?: DP): ReactConstructor<PP> => {
      // @ts-ignore
      return reduxConnect(mergeMapStateToProps<PP, BSP, SP>(baseMapStateToProps, mapStateToProps), mapDispatchToProps)(component);
    };
  };
}
