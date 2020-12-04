import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

export function useElementSize(ref: MutableRefObject<Element | null>): Size | null {
  let [elementSize, setElementSize] = useState<Size | null>(null);

  let observer = useMemo((): ResizeObserver | null => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!("ResizeObserver" in window)) {
      return null;
    }

    return new window.ResizeObserver((entries: readonly ResizeObserverEntry[]) => {
      for (let { target, borderBoxSize } of entries) {
        if (target == ref.current) {
          borderBoxSize = observedSize(borderBoxSize);
          if (!borderBoxSize) {
            continue;
          }

          let {
            inlineSize: width,
            blockSize: height,
          } = borderBoxSize[0];

          if (elementSize && width == elementSize.width && height == elementSize.height) {
            return;
          }

          setElementSize({
            width,
            height,
          });

          return;
        }
      }
    });
  }, [elementSize, ref]);

  useEffect(() => {
    let { current } = ref;
    if (current) {
      if (!elementSize) {
        let { width, height } = current.getBoundingClientRect();
        setElementSize({ width, height });
        return;
      }

      if (observer) {
        observer.observe(current, {
          box: "border-box",
        });
      }
    }

    return () => {
      if (current && observer) {
        observer.unobserve(current);
      }
    };
  }, [elementSize, observer, ref]);

  return elementSize;
}
