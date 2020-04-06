import { produce } from "immer";
import { PureComponent } from "react";

export type MapState<T> = Record<string, T>;

export interface InputState<T> {
  getInputValue: () => Readonly<T>;
  setInputValue: (value: T) => void;
}

export class Inputs<T> implements InputState<T> {
  private state: T;

  public constructor(state: T) {
    this.state = state;
  }

  public getInputValue(): T {
    return this.state;
  }

  public setInputValue(state: T): void {
    this.state = state;
  }
}

export class InputGroup<S extends object> {
  protected state: InputState<S>;

  public constructor(state: InputState<S>) {
    this.state = state;
  }

  protected updateValue(updater: (state: S) => void): void {
    let state = this.state.getInputValue();
    let newState: S = produce(state, updater);

    if (state !== newState) {
      this.state.setInputValue(newState);
    }
  }

  public castInto<T extends S>(
    assertion: (state: Readonly<S>) => state is T,
  ): this is InputGroup<T> {
    if (assertion(this.state.getInputValue())) {
      return true;
    }
    return false;
  }

  public getInputValue<K extends keyof S>(prop: K): Readonly<S[K]> {
    return this.state.getInputValue()[prop];
  }

  public setInputValue<K extends keyof S>(prop: K, val: S[K]): void {
    this.updateValue((state: S): void => {
      state[prop] = val;
    });
  }

  public getInputState<K extends keyof S>(prop: K): InputState<S[K]> {
    return {
      getInputValue: (): Readonly<S[K]> => {
        return this.getInputValue(prop);
      },

      setInputValue: (val: S[K]): void => {
        this.setInputValue(prop, val);
      },
    };
  }
}

export class InputMap<T> extends InputGroup<MapState<T>> {
  public get length(): number {
    return this.keys().length;
  }

  public keys(): string[] {
    return Object.keys(this.state.getInputValue());
  }

  public values(): InputState<T>[] {
    return Object.keys(this.state.getInputValue())
      .map((id: string): InputState<T> => this.getInputState(id));
  }

  public entries(): [string, InputState<T>][] {
    return Object.keys(this.state.getInputValue())
      .map((id: string): [string, InputState<T>] => [id, this.getInputState(id)]);
  }

  public set(id: string, value: T): void {
    this.updateValue((state: MapState<T>): void => {
      state[id] = value;
    });
  }

  public delete(id: string): void {
    this.updateValue((state: MapState<T>): void => {
      delete state[id];
    });
  }
}

export class InputGroupMap<T extends object> extends InputMap<T> {
  public getInputGroup(id: string): InputGroup<T> {
    return new InputGroup(this.getInputState(id));
  }
}

export class ReactInputs<T extends object, P, S extends { inputs: T }> extends PureComponent<P, S> {
  protected inputGroup: InputGroup<T>;

  public constructor(props: P) {
    super(props);

    this.inputGroup = new InputGroup(this);
  }

  protected getInputState<K extends keyof T>(prop: K): InputState<T[K]> {
    return this.inputGroup.getInputState(prop);
  }

  public getInputValue(): T {
    return this.state.inputs;
  }

  public setInputValue(state: T): void {
    this.setState({ inputs: state });
  }
}
