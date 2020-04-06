/* eslint-disable @typescript-eslint/no-explicit-any */
import { Deed } from "deeds/immer";
import { Component } from "react";
import { connect as reduxConnect } from "react-redux";

import { StoreState } from "../store/types";

// Merges two interfaces such that the properties of B replace those of A.
type Merged<A extends {}, B extends {}> = Omit<A, keyof B> & B;

// A React component constructor.
export type ReactConstructor<T, S = {}> = new (props: T) => Component<T, S>;
export type PropsFor<T> =
  T extends Component<infer P> ? P :
    T extends ReactConstructor<infer P> ? P :
      never;

// Dispatch and action types.
type Dispatch = (action: Deed) => void;
type ActionCreator = (...args: any[]) => Deed;

// mapStateToProps.
type MapStateToPropsWithProps<PP extends {}, SP extends {}> =
  (state: StoreState, ownProps: PP) => SP;
type MapStateToPropsWithoutProps<SP extends {}> =
  (state: StoreState) => SP;
export type MapStateToProps<PP extends {} = any, SP extends {} = any> =
  MapStateToPropsWithProps<PP, SP> |
  MapStateToPropsWithoutProps<SP>;
type StateProps<T> = T extends MapStateToProps<any, infer SP> ? SP : {};

// mapDispatchToProps.
type MapDispatchToPropsObject = { [key: string]: ActionCreator };
type MapDispatchToPropsFunctionWithProps<PP extends {}, DP extends {}> =
  (dispatch: Dispatch, ownProps: PP) => DP;
type MapDispatchToPropsFunctionWithoutProps<DP extends {}> =
  (dispatch: Dispatch) => DP;
export type MapDispatchToProps<PP = any, DP = any> =
  MapDispatchToPropsObject |
  MapDispatchToPropsFunctionWithProps<PP, DP> |
  MapDispatchToPropsFunctionWithoutProps<DP>;
type DispatchProps<T> =
  T extends MapDispatchToPropsFunctionWithProps<any, infer DP> ? DP :
    T extends MapDispatchToPropsFunctionWithoutProps<infer DP> ? DP :
      T extends MapDispatchToPropsObject ? { [K in keyof T]: (...args: Parameters<T[K]>) => void } :
        {};

type MergedProps<PP, SP, DP> = Merged<Merged<PP, SP>, DP>;

// Generates the props for a component after mapStateToProps and mapDispatchToProps have done their
// work.
export type ComponentProps<
  PP extends {} = {},
  MSP extends MapStateToProps<PP> | {} = {},
  MDP extends MapDispatchToProps<PP> | {} = {}
> = MergedProps<PP, StateProps<MSP>, DispatchProps<MDP>>;

export interface Connector<PP> {
  (
    component: ReactConstructor<MergedProps<PP, {}, {}>>
  ): ReactConstructor<PP>;
  <SP>(
    component: ReactConstructor<MergedProps<PP, SP, {}>>,
    mapStateToProps: MapStateToProps<PP, SP>,
  ): ReactConstructor<PP>;
  <DP>(
    component: ReactConstructor<MergedProps<PP, {}, DP>>,
    mapStateToProps: undefined,
    mapDispatchToProps: MapDispatchToProps<PP, DP>,
  ): ReactConstructor<PP>;
  <SP, DP>(
    component: ReactConstructor<MergedProps<PP, SP, DP>>,
    mapStateToProps: MapStateToProps<PP, SP>,
    mapDispatchToProps: MapDispatchToProps<PP, DP>,
  ): ReactConstructor<PP>;
}

export function connect<PP = {}>(): Connector<PP> {
  return (
    component: any,
    mapStateToProps?: any,
    mapDispatchToProps?: any,
  ): ReactConstructor<PP> => {
    // @ts-ignore
    return reduxConnect(mapStateToProps, mapDispatchToProps)(component);
  };
}

export type MergedMapStateToProps<PP, BSP, MSP> =
  MapStateToPropsWithProps<PP, Merged<StateProps<BSP>, StateProps<MSP>>>;
export function mergeMapStateToProps<
  PP,
  BSP,
  SP
>(
  a: MapStateToPropsWithoutProps<BSP>,
  b: MapStateToProps<PP, SP>,
): MapStateToProps<PP, Merged<BSP, SP>> {
  return (state: StoreState, ownProps: PP): Merged<BSP, SP> => {
    let aProps: BSP = a(state);
    let bProps: SP = b(state, ownProps);
    return {
      ...aProps,
      ...bProps,
    };
  };
}

export type MergedConnect<BSP> = <PP = {}>() => MergedConnector<PP, BSP>;
export interface MergedConnector<PP, BSP> {
  (
    component: ReactConstructor<MergedProps<PP, BSP, {}>>
  ): ReactConstructor<PP>;
  <SP>(
    component: ReactConstructor<MergedProps<PP, Merged<BSP, SP>, {}>>,
    mapStateToProps: MapStateToProps<PP, SP>,
  ): ReactConstructor<PP>;
  <DP>(
    component: ReactConstructor<MergedProps<PP, BSP, DP>>,
    mapStateToProps: undefined,
    mapDispatchToProps: MapDispatchToProps<PP, DP>,
  ): ReactConstructor<PP>;
  <SP, DP>(
    component: ReactConstructor<MergedProps<PP, Merged<BSP, SP>, DP>>,
    mapStateToProps: MapStateToProps<PP, SP>,
    mapDispatchToProps: MapDispatchToProps<PP, DP>,
  ): ReactConstructor<PP>;
}

export function mergedConnect<BSP>(
  baseMapStateToProps: MapStateToPropsWithoutProps<BSP>,
): MergedConnect<BSP> {
  return <PP = {}>(): MergedConnector<PP, BSP> => {
    return (
      component: any,
      mapStateToProps?: any,
      mapDispatchToProps?: any,
    ): ReactConstructor<PP> => {
      let mapState = mapStateToProps ?
        mergeMapStateToProps(baseMapStateToProps, mapStateToProps) :
        baseMapStateToProps;

      // @ts-ignore
      return reduxConnect(mapState, mapDispatchToProps)(component);
    };
  };
}
