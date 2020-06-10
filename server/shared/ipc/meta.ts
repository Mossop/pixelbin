export type MaybePromise<T> = T | Promise<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Callable = (arg?: any) => any;
export type RemotableInterface = Record<string, Callable>;
export type Decoder<T> = (arg: unknown) => MaybePromise<T>;

/**
 * Given the interface that will be callable in this process infers the decoders
 * necessary for the method arguments.
 */
export type ArgDecodersFor<T extends RemotableInterface> = {
  [K in MethodsWithArgs<T>]: ArgDecoderFor<T[K]>;
};

/**
 * Given the interface that will be callable in the remote process infers the
 * decoders necessary for the method returns.
 */
export type ReturnDecodersFor<T extends RemotableInterface> = {
  [K in MethodsWithReturns<T>]: ReturnDecoderFor<T[K]>;
};

export type RemoteInterface<T extends RemotableInterface> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => Promise<Return<T[K]>>;
};

// Here lies the magic.
type MethodsWithArgs<T> = {
  [K in keyof T]: T[K] extends () => unknown ? never : K;
}[keyof T];
type ArgDecoderFor<T> = T extends (arg: infer A) => unknown ? Decoder<A> : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Return<T> = T extends (...args: any[]) => infer R ?
  R extends Promise<infer P> ? P : R :
  never;
type MethodsWithReturns<T> = {
  [K in keyof T]: Return<T[K]> extends void ? never : K;
}[keyof T];
type ReturnDecoderFor<T> = Decoder<Return<T>>;
