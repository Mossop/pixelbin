import { FluentBundle, FluentResource } from "@fluent/bundle";
import { negotiateLanguages } from "@fluent/langneg";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import type { ReactNode } from "react";
import { PureComponent } from "react";

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
  locales: string[];
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

    let supportedLocales = negotiateLanguages(
      window.navigator.languages.slice(), // requested locales
      props.locales, // available locales
      { defaultLocale: props.locales[0] },
    );

    void this.retrieveBundles(supportedLocales);
  }

  private async retrieveBundles(locales: string[]): Promise<void> {
    function isBundle(bundle: FluentBundle | null): bundle is FluentBundle {
      return !!bundle;
    }

    let retrieve = (l: string): Promise<FluentBundle | null> => {
      return retrieveBundle(this.props.baseurl, l);
    };
    let bundles = (await Promise.all(locales.map(retrieve)))
      .filter(isBundle);

    this.setState({
      generatedBundles: bundles,
    });
  }

  public render(): ReactNode {
    let l10n = new ReactLocalization(this.state.generatedBundles);

    return <LocalizationProvider l10n={l10n}>
      {this.props.children}
    </LocalizationProvider>;
  }
}
