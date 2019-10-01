import { Action } from "redux";

import { State, StoreState } from "../types";

export enum ActionType {
  Callable,
}

export abstract class BaseAction implements Action {
  public type: ActionType = ActionType.Callable;

  public abstract apply(state: StoreState): StoreState;
}

export class ShowLoginOverlay extends BaseAction {
  public apply(state: StoreState): StoreState {
    state.page.overlay = {

    };
    return state;
  }
}

export class CompleteLogin extends BaseAction {
  private newState: State;

  public constructor(newState: State) {
    super();
    this.newState = newState;
  }

  public apply(state: StoreState): StoreState {
    state.state = this.newState;
    state.page.overlay = null;
    return state;
  }
}
