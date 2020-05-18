import { FluentBundle, FluentResource } from "@fluent/bundle";
import { negotiateLanguages } from "@fluent/langneg";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import React, { PureComponent, ReactNode } from "react";

import { window, fetch } from "../environment";

async function retrieveBundle(baseurl: string, locale: string): Promise<null | FluentBundle> {
  let response = await fetch(`${baseurl}${locale}.txt`);
  if (response.ok) {
    let source = await response.text();
    let bundle = new FluentBundle(locale);
    let resource = new FluentResource(source);
    let errors = bundle.addResource(resource);
    errors.map((e: Error): void => console.error(e));

    return errors.length == 0 ? bundle : null;
  } else {
    console.error(`Failed to retrieve ${locale} bundle: ${response.status} ${response.statusText}`);
  }
  return null;
}

interface LocalizationContextProps {
  baseurl: string;
}

interface LocalizationContextState {
  generatedBundles: FluentBundle[];
}

export class LocalizationContext extends PureComponent<
  LocalizationContextProps,
  LocalizationContextState
> {
  public constructor(props: LocalizationContextProps) {
    super(props);

    this.state = {
      generatedBundles: [],
    };

    const supportedLocales = negotiateLanguages(
      window.navigator.languages.slice(), // requested locales
      ["en-US"], // available locales
      { defaultLocale: "en-US" },
    );

    this.retrieveBundles(supportedLocales);
  }

  private async retrieveBundles(locales: string[]): Promise<void> {
    function isAllBundles(bundles: (null | FluentBundle)[]): bundles is FluentBundle[] {
      return !!bundles;
    }

    let retrieve = (l: string): Promise<FluentBundle | null> => {
      return retrieveBundle(this.props.baseurl, l);
    };
    let bundles = (await Promise.all(locales.map(retrieve)))
      .filter((b: null | FluentBundle): boolean => !!b);

    if (isAllBundles(bundles)) {
      this.setState({
        generatedBundles: bundles,
      });
    }
  }

  public render(): ReactNode {
    let l10n = new ReactLocalization(this.state.generatedBundles);

    return <LocalizationProvider l10n={l10n}>
      {this.props.children}
    </LocalizationProvider>;
  }
}
