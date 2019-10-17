declare module "@fluent/langneg" {
  export interface NegotiateOptions {
    strategy?: "filtering" | "matching" | "lookup";
    defaultLocale?: string;
  }

  export function negotiateLanguages(requestedLocales: string[], availableLocales: string[], options: NegotiateOptions): string[];
}

declare module "@fluent/bundle" {
  export class FluentResource {
    public constructor(source: string);
  }

  export interface BundleOptions {
    functions: {
      [name: string]: () => string;
    };
    useIsolating?: boolean;
    transform?: (s: string) => string;
  }

  export class FluentBundle {
    public constructor(locales: string | string[], options?: BundleOptions);

    public addResource(resource: FluentResource, options?: { allowOverrides?: boolean }): Error[];
  }
}

declare module "@fluent/react" {
  import React from "react";
  import { FluentBundle } from "@fluent/bundle";

  export interface AllowedAttributes {
    [attribute: string]: boolean;
  }

  export interface LocalizedProps {
    // Localization arguments. Has to include node or the children property is invalid.
    [key: string]: string | number | React.ReactNode;
    id: string;
    attrs?: AllowedAttributes;
    children: React.ReactNode;
  }

  export class Localized extends React.Component<LocalizedProps> {
    public relocalize(): void;
  }

  export interface ProviderProps {
    bundles: Iterable<FluentBundle>;
    parseMarkup?: (str: string) => Node[];
  }

  export class LocalizationProvider extends React.Component<ProviderProps> {}
}
