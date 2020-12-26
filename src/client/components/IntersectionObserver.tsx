import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { ReactResult } from "../utils/types";

class IntersectionListener {
  private observer: IntersectionObserver | undefined;
  private readonly elements: Map<Element, (entry: IntersectionObserverEntry) => void>;

  public constructor() {
    this.elements = new Map();
  }

  public setObserver(observer: IntersectionObserver | undefined): void {
    if (observer === this.observer) {
      return;
    }

    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = observer;

    if (this.observer) {
      for (let element of this.elements.keys()) {
        this.observer.observe(element);
      }
    }
  }

  public observeElement(
    element: Element,
    callback: (entry: IntersectionObserverEntry) => void,
  ): void {
    this.elements.set(element, callback);
    this.observer?.observe(element);
  }

  public unobserveElement(element: Element): void {
    this.observer?.unobserve(element);
    this.elements.delete(element);
  }

  public onIntersection(entries: IntersectionObserverEntry[]): void {
    for (let entry of entries) {
      let observer = this.elements.get(entry.target);
      if (observer) {
        try {
          observer(entry);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}

const IntersectionContext = createContext<IntersectionListener>(new IntersectionListener());

export interface IntersectionRootProps {
  root?: Element | null;
  margin?: string;
  threshold?: number | number[];
  children: React.ReactNode;
}

export function IntersectionRoot({
  root,
  margin,
  threshold,
  children,
}: IntersectionRootProps): ReactResult {
  let listener = useMemo(() => {
    return new IntersectionListener();
  }, []);

  useEffect(() => {
    if (root === null) {
      return;
    }
    let observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]): void => listener.onIntersection(entries),
      {
        root,
        rootMargin: margin,
        threshold,
      },
    );

    listener.setObserver(observer);

    return () => listener.setObserver(undefined);
  }, [root, margin, threshold, listener]);

  return <IntersectionContext.Provider value={listener}>
    {children}
  </IntersectionContext.Provider>;
}

export enum IntersectionState {
  NotIntersecting,
  PreviouslyIntersecting,
  Intersecting,
}

export function useIntersectionState(element: Element | null): IntersectionState {
  let [state, setState] = useState(IntersectionState.NotIntersecting);

  let listener = useContext(IntersectionContext);

  let callback = useCallback((entry: IntersectionObserverEntry): void => {
    setState((state: IntersectionState): IntersectionState => {
      if (entry.isIntersecting) {
        return IntersectionState.Intersecting;
      }

      if (state == IntersectionState.NotIntersecting) {
        return state;
      }

      return IntersectionState.PreviouslyIntersecting;
    });
  }, []);

  useEffect(() => {
    if (!element) {
      return;
    }

    listener.observeElement(element, callback);
    return () => listener.unobserveElement(element);
  }, [callback, listener, element]);

  return state;
}
