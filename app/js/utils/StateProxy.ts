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

export const ProxyMarker = Symbol();

export type Proxyable<T> = {
  -readonly [K in keyof T]: T[K] extends object ? T[K] & Proxyable<T[K]> : T[K];
} & { [ProxyMarker]?: boolean };

export function proxy<T extends object>(obj: T): T {
  obj[ProxyMarker] = true;
  return obj;
}

class SubHandler<T extends object> implements ProxyHandler<T> {
  private outer: Property<T>;

  public constructor(outer: Property<T>) {
    this.outer = outer;
  }

  public getOwnPropertyDescriptor<K extends keyof T>(target: T, prop: K): PropertyDescriptor | undefined {
    let descriptor = Object.getOwnPropertyDescriptor(this.outer.get(), prop);
    if (!descriptor) {
      return undefined;
    }

    if ("value" in descriptor) {
      descriptor.value = this.get(target, prop);
    }

    if (descriptor.get) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      descriptor.get = (): T[K] => {
        return this.get(target, prop);
      };
    }

    if (descriptor.set) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      descriptor.set = (val: T[K]): void => {
        this.set(target, prop, val);
      };
    }

    return descriptor;
  }

  public ownKeys(): string[] {
    return Object.keys(this.outer.get());
  }

  public has(_: T, prop: string): boolean {
    return prop in this.outer.get();
  }

  public get<K extends keyof T>(target: T, prop: K): T[K] {
    let obj = this.outer.get();
    let inner = obj[prop];

    if (typeof inner === "object" && ProxyMarker in inner) {
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

class ReactState<C extends React.Component, K extends keyof C["state"]> implements Property<C["state"][K]> {
  private state: C["state"][K];
  private component: C;
  private prop: K;

  public constructor(component: C, prop: K) {
    this.component = component;
    this.prop = prop;
    // @ts-ignore
    this.state = component.state[prop];
  }

  public get(): Readonly<C["state"][K]> {
    return this.state;
  }

  public set(val: C["state"][K]): void {
    this.state = val;
    this.component.setState({ [this.prop]: val });
  }
}

export function proxyReactState<C extends React.Component, K extends keyof C["state"]>(component: C, prop: K): C["state"][K] {
  return buildProxy(new ReactState(component, prop));
}
