import { Store } from "redux";

import { ActionType } from "./actions";
import { StoreState } from "./types";

type Resolver = (state: StoreState) => void;

export class AsyncDispatchListener {
  private waitingForReducer: Map<ActionType, Resolver> = new Map();
  private waitingForState: Resolver[] = [];
  private storeDispatch: (action: ActionType) => void;

  public constructor(store: Store<StoreState>) {
    this.storeDispatch = store.dispatch;
    store.subscribe(() => this.stateChanged(store.getState()));
  }

  public seenAction(action: ActionType): void {
    let resolver = this.waitingForReducer.get(action);
    if (!resolver) {
      return;
    }

    this.waitingForReducer.delete(action);
    this.waitingForState.push(resolver);
  }

  public stateChanged(state: StoreState): void {
    let resolvers = this.waitingForState;
    this.waitingForState = [];
    for (let resolver of resolvers) {
      resolver(state);
    }
  }

  public dispatch(action: ActionType): Promise<StoreState> {
    return new Promise((resolve: Resolver) => {
      this.waitingForReducer.set(action, resolve);
      this.storeDispatch(action);
    });
  }
}
