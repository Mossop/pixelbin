import { createContext, useCallback, useContext, useEffect } from "react";

import type { ReactChildren, ReactResult } from "../utils/types";
import { ReactMemo } from "../utils/types";

type Source = "page" | "overlay" | "dialog";

class TitleManager {
  private page: string | null = null;
  private overlay: string | null = null;
  private dialog: string | null = null;
  private titleNode: HTMLHeadingElement;

  public constructor(private readonly defaultTitle: string) {
    this.titleNode = document.createElement("h1");
    this.titleNode = document.createElement("h1");
    document.getElementById("title")?.appendChild(this.titleNode);
    this.updateTitle();
  }

  public setTitleElement(element: HTMLHeadingElement | null): void {
    if (element === null) {
      this.titleNode = document.createElement("h1");
      document.getElementById("title")?.appendChild(this.titleNode);
    } else if (this.titleNode !== element) {
      this.titleNode.remove();
      this.titleNode = element;
    }

    this.updateTitle();
  }

  public setTitleFromSource(source: Source, title: string | null): void {
    this[source] = title;
    this.updateTitle();
  }

  private updateTitle(): void {
    let title = this.dialog ?? this.overlay ?? this.page ?? this.defaultTitle;
    this.titleNode.textContent = title;
    document.title = title;
  }
}

const TitleContext = createContext<TitleManager | null>(null);

interface TitleProps {
  title: string;
  source: Source;
}

export default ReactMemo(function Title({ title, source }: TitleProps): ReactResult {
  let manager = useContext(TitleContext);

  useEffect(() => {
    manager?.setTitleFromSource(source, title);
    return () => manager?.setTitleFromSource(source, null);
  }, [manager, title, source]);

  return null;
});

export interface TitleProviderProps {
  defaultTitle: string;
}

export function TitleProvider({
  defaultTitle,
  children,
}: TitleProviderProps & ReactChildren): ReactResult {
  return <TitleContext.Provider
    value={new TitleManager(defaultTitle)}
  >
    {children}
  </TitleContext.Provider>;
}

export function PageTitle(): ReactResult {
  let manager = useContext(TitleContext);

  let updateElement = useCallback((element: HTMLHeadingElement | null): void => {
    manager?.setTitleElement(element);
  }, [manager]);

  return <h1 ref={updateElement}/>;
}
