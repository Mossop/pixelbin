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
    let observer: ResizeObserver | undefined = undefined;

    if (!("ResizeObserver" in window) || !element) {
      return;
    }

    observer = new ResizeObserver((entries: readonly ResizeObserverEntry[]) => {
      for (let { target, borderBoxSize } of entries) {
        if (target == element) {
          borderBoxSize = observedSize(borderBoxSize);
          if (!borderBoxSize) {
            continue;
          }

          let {
            inlineSize: width,
            blockSize: height,
          } = borderBoxSize[0];

          setSize(width, height);
          return;
        }
      }
    });

    observer.observe(element, {
      box: "border-box",
    });

    let { width, height } = element.getBoundingClientRect();
    setElementSize({ width, height });

    return () => {
      if (observer) {
        observer.disconnect();
      }
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
    let observer: ResizeObserver | undefined = undefined;

    if (!("ResizeObserver" in window) || !element) {
      return;
    }

    observer = new ResizeObserver((entries: readonly ResizeObserverEntry[]) => {
      for (let { target, borderBoxSize } of entries) {
        if (target == element) {
          borderBoxSize = observedSize(borderBoxSize);
          if (!borderBoxSize) {
            continue;
          }

          let {
            inlineSize: width,
          } = borderBoxSize[0];

          setWidth(width);
          return;
        }
      }
    });

    observer.observe(element, {
      box: "border-box",
    });

    let { width } = element.getBoundingClientRect();
    setElementWidth(width);

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [element, setWidth]);

  return elementWidth;
}
