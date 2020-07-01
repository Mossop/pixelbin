/* eslint-disable @typescript-eslint/no-explicit-any */
import { Deed } from "deeds/immer";
import { Component } from "react";
import { connect as reduxConnect } from "react-redux";

import { Obj } from "../../../utils";
import { StoreState } from "../store/types";

// Merges two interfaces such that the properties of B replace those of A.
type Merged<A extends Obj, B extends Obj> = Omit<A, keyof B> & B;

// A React component constructor.
export type ReactConstructor<T, S = Obj> = new (props: T) => Component<T, S>;
export type PropsFor<T> =
  T extends Component<infer P> ? P :
    T extends ReactConstructor<infer P> ? P :
      never;

// Dispatch and action types.
type Dispatch = (action: Deed) => void;
type ActionCreator = (...args: any[]) => Deed;

// mapStateToProps.
type MapStateToPropsWithProps<PP extends Obj, SP extends Obj> =
  (state: StoreState, ownProps: PP) => SP;
type MapStateToPropsWithoutProps<SP extends Obj> =
  (state: StoreState) => SP;
export type MapStateToProps<PP extends Obj = any, SP extends Obj = any> =
  MapStateToPropsWithProps<PP, SP> |
  MapStateToPropsWithoutProps<SP>;
type StateProps<T> = T extends MapStateToProps<any, infer SP> ? SP : Obj;

// mapDispatchToProps.
type MapDispatchToPropsObject = { [key: string]: ActionCreator };
type MapDispatchToPropsFunctionWithProps<PP extends Obj, DP extends Obj> =
  (dispatch: Dispatch, ownProps: PP) => DP;
type MapDispatchToPropsFunctionWithoutProps<DP extends Obj> =
  (dispatch: Dispatch) => DP;
export type MapDispatchToProps<PP = any, DP = any> =
  MapDispatchToPropsObject |
  MapDispatchToPropsFunctionWithProps<PP, DP> |
  MapDispatchToPropsFunctionWithoutProps<DP>;
type DispatchProps<T> =
  T extends MapDispatchToPropsFunctionWithProps<any, infer DP> ? DP :
    T extends MapDispatchToPropsFunctionWithoutProps<infer DP> ? DP :
      T extends MapDispatchToPropsObject ? { [K in keyof T]: (...args: Parameters<T[K]>) => void } :
        Obj;

type MergedProps<PP, SP, DP> = Merged<Merged<PP, SP>, DP>;

// Generates the props for a component after mapStateToProps and mapDispatchToProps have done their
// work.
export type ComponentProps<
  PP extends Obj = Obj,
  MSP extends MapStateToProps<PP> | Obj = Obj,
  MDP extends MapDispatchToProps<PP> | Obj = Obj
> = MergedProps<PP, StateProps<MSP>, DispatchProps<MDP>>;

export interface Connector<PP> {
  (
    component: ReactConstructor<MergedProps<PP, Obj, Obj>>
  ): ReactConstructor<PP>;
  <SP>(
    component: ReactConstructor<MergedProps<PP, SP, Obj>>,
    mapStateToProps: MapStateToProps<PP, SP>,
  ): ReactConstructor<PP>;
  <DP>(
    component: ReactConstructor<MergedProps<PP, Obj, DP>>,
    mapStateToProps: undefined,
    mapDispatchToProps: MapDispatchToProps<PP, DP>,
  ): ReactConstructor<PP>;
  <SP, DP>(
    component: ReactConstructor<MergedProps<PP, SP, DP>>,
    mapStateToProps: MapStateToProps<PP, SP>,
    mapDispatchToProps: MapDispatchToProps<PP, DP>,
  ): ReactConstructor<PP>;
}

export function connect<PP = Obj>(): Connector<PP> {
  return (
    component: any,
    mapStateToProps?: any,
    mapDispatchToProps?: any,
  ): ReactConstructor<PP> => {
    // @ts-ignore: Too complex for TypeScript.
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

export type MergedConnect<BSP> = <PP = Obj>() => MergedConnector<PP, BSP>;
export interface MergedConnector<PP, BSP> {
  (
    component: ReactConstructor<MergedProps<PP, BSP, Obj>>
  ): ReactConstructor<PP>;
  <SP>(
    component: ReactConstructor<MergedProps<PP, Merged<BSP, SP>, Obj>>,
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
  return <PP = Obj>(): MergedConnector<PP, BSP> => {
    return (
      component: any,
      mapStateToProps?: any,
      mapDispatchToProps?: any,
    ): ReactConstructor<PP> => {
      let mapState = mapStateToProps ?
        mergeMapStateToProps(baseMapStateToProps, mapStateToProps) :
        baseMapStateToProps;

      // @ts-ignore: Too complex for TypeScript.
      return reduxConnect(mapState, mapDispatchToProps)(component);
    };
  };
}
