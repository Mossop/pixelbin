import { Deed } from "deeds/immer";
import { Store } from "redux";

import { StoreState } from "./types";

type Resolver = (state: StoreState) => void;

export class AsyncDispatchListener {
  private waitingForReducer: Map<Deed, Resolver> = new Map();
  private waitingForState: Resolver[] = [];
  private storeDispatch: (action: Deed) => void;

  public constructor(store: Store<StoreState, Deed>) {
    this.storeDispatch = store.dispatch;
    store.subscribe(() => this.stateChanged(store.getState()));
  }

  public seenAction(action: Deed): void {
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

  public dispatch(action: Deed): Promise<StoreState> {
    return new Promise((resolve: Resolver) => {
      this.waitingForReducer.set(action, resolve);
      this.storeDispatch(action);
    });
  }
}
