export interface Property<T> {
  get: () => Readonly<T>;
  set: (val: T) => void;
}

export function makeProperty<T extends object, K extends keyof T>(obj: T, prop: K): Property<T[K]> {
  return {
    get(): T[K] {
      return obj[prop];
    },

    set(val: T[K]): void {
      obj[prop] = val;
    }
  };
}

class SubHandler<T extends object> implements ProxyHandler<T> {
  private outer: Property<T>;

  public constructor(outer: Property<T>) {
    this.outer = outer;
  }

  public has(_: T, prop: string): boolean {
    return prop in this.outer.get();
  }

  public get<K extends keyof T>(target: T, prop: K): T[K] {
    let obj = this.outer.get();
    let inner = obj[prop];

    if (typeof inner === "object") {
      let getter: () => Readonly<T[K]> = () => this.outer.get()[prop];
      let setter: (val: T[K]) => void = (val: T[K]) => this.set(target, prop, val);

      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return buildProxy({
        get: getter,
        set: setter,
      });
    } else {
      return inner;
    }
  }

  public set<K extends keyof T>(_: T, prop: K, val: T[K]): boolean {
    this.outer.set(Object.assign({}, this.outer.get(), { [prop]: val }));
    return true;
  }

  public deleteProperty<K extends keyof T>(_: T, prop: K): boolean {
    let obj = Object.assign({}, this.outer.get());
    delete obj[prop];
    this.outer.set(obj);
    return true;
  }
}

export function buildProxy<T>(outer: Property<T>): T {
  // @ts-ignore
  return new Proxy({}, new SubHandler(outer));
}

export function proxyReactState<C extends React.Component, K extends keyof C["state"]>(component: C, prop: K): C["state"][K] {
  return buildProxy({
    get(): Readonly<C["state"][K]> {
      // @ts-ignore
      return component.state[prop];
    },

    set(val: C["state"][K]): void {
      // @ts-ignore
      component.setState({ [prop]: val });
    }
  });
}
