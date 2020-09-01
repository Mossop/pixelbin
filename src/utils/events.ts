import { EventEmitter as Base } from "events";

// eslint-disable-next-line @typescript-eslint/ban-types
export type EventMap = {};
export type Events<M extends EventMap> = keyof M;
export type Payload<M extends EventMap, E extends Events<M>> = M[E] extends unknown[] ? M[E] : [];
// See https://github.com/typescript-eslint/typescript-eslint/milestone/7.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Listener<M extends EventMap, E extends Events<M>> = (...args: Payload<M, E>) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitters = new WeakMap<TypedEmitter<any>, Base>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emitterFor(emitter: TypedEmitter<any>): Base {
  let base = emitters.get(emitter);
  if (base) {
    return base;
  }

  base = new Base();
  emitters.set(emitter, base);
  return base;
}

export class TypedEmitter<M extends EventMap> {
  protected emit<E extends Events<M>>(message: E, ...payload: Payload<M, E>): void {
    // @ts-ignore: This is guaranteed to be correct.
    emitterFor(this).emit(message, ...payload);
  }

  public on<E extends Events<M>>(message: E, listener: Listener<M, E>): void {
    // @ts-ignore: This is guaranteed to be correct.
    emitterFor(this).on(message, listener);
  }

  public once<E extends Events<M>>(message: E, listener: Listener<M, E>): void {
    // @ts-ignore: This is guaranteed to be correct.
    emitterFor(this).once(message, listener);
  }

  public off<E extends Events<M>>(message: E, listener: Listener<M, E>): void {
    // @ts-ignore: This is guaranteed to be correct.
    emitterFor(this).off(message, listener);
  }

  public addListener<E extends Events<M>>(message: E, listener: Listener<M, E>): void {
    // @ts-ignore: This is guaranteed to be correct.
    emitterFor(this).addListener(message, listener);
  }

  public removeListener<E extends Events<M>>(message: E, listener: Listener<M, E>): void {
    // @ts-ignore: This is guaranteed to be correct.
    emitterFor(this).on(message, listener);
  }
}

export class SharedEmitter<M extends EventMap> extends TypedEmitter<M> {
  public emit<E extends Events<M>>(message: E, ...payload: Payload<M, E>): void {
    super.emit(message, ...payload);
  }
}
