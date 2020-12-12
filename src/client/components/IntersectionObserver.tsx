import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { ReactResult } from "../utils/types";

class IntersectionListener {
  private readonly observer: IntersectionObserver;
  private readonly observers: WeakMap<Element, (entry: IntersectionObserverEntry) => void>;

  public constructor(options: IntersectionObserverInit) {
    this.observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => this.onIntersection(entries),
      options,
    );

    this.observers = new WeakMap();
  }

  public addObserver(element: Element, callback: (entry: IntersectionObserverEntry) => void): void {
    this.observers.set(element, callback);
    this.observer.observe(element);
  }

  public removeObserver(element: Element): void {
    this.observer.unobserve(element);
    this.observers.delete(element);
  }

  private onIntersection(entries: IntersectionObserverEntry[]): void {
    for (let entry of entries) {
      let observer = this.observers.get(entry.target);
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

const IntersectionContext = createContext<IntersectionListener | null>(null);

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
    if (root === null) {
      return null;
    }

    return new IntersectionListener({
      root,
      rootMargin: margin,
      threshold,
    });
  }, [root, margin, threshold]);

  return <IntersectionContext.Provider value={listener}>
    {children}
  </IntersectionContext.Provider>;
}

export type MountOnIntersectProps = {
  children: React.ReactNode;
  unmount?: boolean;
} & React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;

export function MountOnIntersect(props: MountOnIntersectProps): ReactResult {
  let listener = useContext(IntersectionContext);
  let ref = useRef<HTMLDivElement>(null);
  let [intersected, setIntersected] = useState(false);

  let {
    children,
    unmount,
    ...divProps
  } = props;

  useEffect((): (() => void) | void => {
    if (ref.current && listener) {
      let current = ref.current;

      listener.addObserver(current, (entry: IntersectionObserverEntry): void => {
        if (entry.isIntersecting) {
          setIntersected(true);
        } else if (unmount) {
          setIntersected(false);
        }
      });

      return () => listener?.removeObserver(current);
    }
  }, [listener, unmount]);

  return <div ref={ref} {...divProps}>
    {intersected && children}
  </div>;
}
