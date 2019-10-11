import React from "react";
import { Localized } from "@fluent/react";

import { L10nProps } from "../l10n";
import { TextComponent } from "../utils/uicontext";
import { fieldProps, UIProps } from "./shared";

export type SelectOption = {
  value: string;
} & L10nProps;

export type SelectboxProps = {
  choices: SelectOption[];
} & UIProps;

export default class Selectbox extends TextComponent<SelectboxProps> {
  private onChange: ((event: React.ChangeEvent<HTMLSelectElement>) => void) = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setUIState(event.target.value);
  };

  public render(): React.ReactNode {
    return <select {...fieldProps(this.props, { className: "field" })} value={this.getUIState()} onChange={this.onChange}>
      {this.props.choices.map((choice: SelectOption) => {
        return <Localized id={choice.l10n} key={choice.value}><option value={choice.value}/></Localized>;
      })}
    </select>;
  }
}
