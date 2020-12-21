import { useRef, useCallback, useEffect, useState } from "react";

import { document, window } from "../environment";

export type FormStateSetter<T> = <K extends keyof T>(key: K, value: T[K]) => void;
type FormHook<T> = [T, FormStateSetter<T>];

export function useFormState<T>(initial: T): FormHook<T> {
  let [currentState, stateSetter] = useState(initial);

  let setter = useCallback(<K extends keyof T>(key: K, value: T[K]): void => {
    stateSetter((previous: T): T => {
      return {
        ...previous,
        [key]: value,
      };
    });
  }, []);

  return [currentState, setter];
}

export function useFullscreen(): boolean {
  let [fullscreen, setFullscreen] = useState(document.fullscreenElement != null);

  useEffect(() => {
    let listener = (): void => {
      setFullscreen(document.fullscreenElement != null);
    };

    document.addEventListener("fullscreenchange", listener);

    return () => {
      document.removeEventListener("fullscreenchange", listener);
    };
  });

  return fullscreen;
}

interface PromiseResult<T> {
  result: T | undefined;
  error: Error | undefined;
}
export function usePromise<T>(promise: Promise<T>): T | undefined {
  let [result, setResult] = useState<PromiseResult<T>>({
    result: undefined,
    error: undefined,
  });

  useEffect(() => {
    let cancelled = false;
    setResult({
      result: undefined,
      error: undefined,
    });

    promise.then((result: T) => {
      if (!cancelled) {
        setResult({
          result,
          error: undefined,
        });
      }
    }, (error: Error) => {
      if (!cancelled) {
        setResult({
          result: undefined,
          error,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [promise]);

  if (result.error) {
    throw result.error;
  }

  return result.result;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Firefox incorrectly returns a ResizeObserverSize rather than an array, this
 * works around that.
 */
type ObservedSize = readonly ResizeObserverSize[] | undefined;
function observedSize(size: ObservedSize | ResizeObserverSize): ObservedSize {
  if (!size) {
    return undefined;
  }

  if (!Array.isArray(size)) {
    // @ts-ignore
    return [size];
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return size;
}

type SizeSetter = (width: number, height: number) => void;
class SizeObserver {
  private observer: ResizeObserver;
  private elements: WeakMap<Element, SizeSetter>;
  private static singleton: SizeObserver | undefined = undefined;

  public constructor() {
    this.elements = new WeakMap();
    this.observer = new window.ResizeObserver((entries: readonly ResizeObserverEntry[]) => {
      for (let entry of entries) {
        this.handleEntry(entry);
      }
    });
  }

  private static get instance(): SizeObserver {
    if (!SizeObserver.singleton) {
      SizeObserver.singleton = new SizeObserver();
    }
    return SizeObserver.singleton;
  }

  private handleEntry({ target, borderBoxSize }: ResizeObserverEntry): void {
    let callback = this.elements.get(target);
    if (!callback) {
      return;
    }

    borderBoxSize = observedSize(borderBoxSize);
    if (!borderBoxSize) {
      return;
    }

    let {
      inlineSize: width,
      blockSize: height,
    } = borderBoxSize[0];

    callback(width, height);
  }

  private register(element: Element, callback: SizeSetter): void {
    this.elements.set(element, callback);
    this.observer.observe(element, {
      box: "border-box",
    });

    let { width, height } = element.getBoundingClientRect();
    callback(width, height);
  }

  private unregister(element: Element): void {
    this.observer.unobserve(element);
    this.elements.delete(element);
  }

  public static observe(element: Element, callback: SizeSetter): void {
    SizeObserver.instance.register(element, callback);
  }

  public static unobserve(element: Element): void {
    SizeObserver.instance.unregister(element);
  }
}

const initialSize = "ResizeObserver" in window ? undefined : null;
export function useElementSize(element: Element | null | undefined): Size | null | undefined {
  let [elementSize, setElementSize] = useState<Size | null | undefined>(initialSize);

  let size = useRef<{ width: number; height: number } | undefined>(undefined);

  let setSize = useCallback((width: number, height: number): void => {
    if (!size.current || size.current.width != width || size.current.height != height) {
      size.current = {
        width,
        height,
      };
      setElementSize(size.current);
    }
  }, []);

  useEffect(() => {
    if (!("ResizeObserver" in window) || !element) {
      return;
    }

    SizeObserver.observe(element, setSize);

    return () => {
      SizeObserver.unobserve(element);
    };
  }, [element, setSize]);

  return elementSize;
}

export function useElementWidth(element: Element | null | undefined): number | null | undefined {
  let [elementWidth, setElementWidth] = useState<number | null | undefined>(initialSize);

  let width = useRef<number | undefined>(undefined);

  let setWidth = useCallback((newWidth: number): void => {
    if (width.current != newWidth) {
      width.current = newWidth;
      setElementWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    if (!("ResizeObserver" in window) || !element) {
      return;
    }

    SizeObserver.observe(element, setWidth);

    return () => {
      SizeObserver.unobserve(element);
    };
  }, [element, setWidth]);

  return elementWidth;
}

type EventHandler<E> = (event: E) => void;
export function useChainedEvent<E>(
  handler: EventHandler<E>,
  original?: EventHandler<E> | null,
): EventHandler<E> {
  return useCallback((event: E): void => {
    if (original) {
      original(event);
    }

    handler(event);
  }, [handler, original]);
}

export function useViewportSize(): Size {
  let [size, setSize] = useState<Size>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  let update = useCallback(() => {
    let { innerWidth, innerHeight } = window;
    setSize((size: Size): Size => {
      if (innerWidth != size.width || innerHeight != size.height) {
        return {
          width: innerWidth,
          height: innerHeight,
        };
      }

      return size;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  return size;
}
