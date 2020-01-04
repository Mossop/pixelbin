import React from "react";
import { LocalizationProvider } from "@fluent/react";
import { negotiateLanguages } from "@fluent/langneg";
import { FluentBundle, FluentResource } from "@fluent/bundle";

export interface L10nArgs {
  [key: string]: string | number;
}

export interface LocalizedProps {
  id: string;
  [key: string]: string | number;
}

export function l10nAttributes(id: string, args?: L10nArgs): LocalizedProps {
  let attributes: LocalizedProps = {
    id,
  };

  if (args) {
    for (let [key, val] of Object.entries(args)) {
      attributes[`$${key}`] = val;
    }
  }

  return attributes;
}

export interface L10nProps {
  l10n: string;
  args?: L10nArgs;
}

export type OptionalL10nProps = Partial<L10nProps>;

async function retrieveBundle(baseurl: string, locale: string): Promise<null | FluentBundle> {
  let response = await fetch(`${baseurl}${locale}.txt`);
  if (response.ok) {
    let source = await response.text();
    let bundle = new FluentBundle(locale);
    let resource = new FluentResource(source);
    let errors = bundle.addResource(resource);
    errors.map((e: Error) => console.error(e));

    return errors.length == 0 ? bundle : null;
  } else {
    console.error(`Failed to retrieve ${locale} bundle: ${response.status} ${response.statusText}`);
  }
  return null;
}

interface ContextProps {
  baseurl: string;
}

interface ContextState {
  generateBundles: FluentBundle[];
}

export default class LocalizationContext extends React.Component<ContextProps, ContextState> {
  public constructor(props: ContextProps) {
    super(props);

    this.state = {
      generateBundles: [],
    };

    const supportedLocales = negotiateLanguages(
      navigator.languages.slice(),       // requested locales
      ["en-US"],                         // available locales
      { defaultLocale: "en-US" }
    );

    this.retrieveBundles(supportedLocales);
  }

  private async retrieveBundles(locales: string[]): Promise<void> {
    function isAllBundles(bundles: (null | FluentBundle)[]): bundles is FluentBundle[] {
      return !!bundles;
    }

    let bundles = (await Promise.all(locales.map((l: string) => retrieveBundle(this.props.baseurl, l)))).filter((b: null | FluentBundle) => !!b);

    if (isAllBundles(bundles)) {
      this.setState({
        generateBundles: bundles,
      });
    }
  }

  public render(): React.ReactNode {
    return <LocalizationProvider bundles={this.state.generateBundles}>{this.props.children}</LocalizationProvider>;
  }
}
