import React from "react";
import { Localized } from "@fluent/react";

import { L10nProps } from "../l10n";
import { TextComponent } from "../utils/UIState";
import { fieldProps, UIProps } from "./shared";
import Icon, { IconProps } from "./Icon";

export type SelectOption = {
  value: string;
} & L10nProps;

export type SelectboxProps = {
  choices: SelectOption[];
} & UIProps & IconProps;

export default class Selectbox extends TextComponent<SelectboxProps> {
  private onChange: ((event: React.ChangeEvent<HTMLSelectElement>) => void) = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setUIState(event.target.value);
  };

  public render(): React.ReactNode {
    if (this.props.iconName) {
      return <React.Fragment>
        <span className="field-icon"><Icon iconName={this.props.iconName} iconType={this.props.iconType}/></span>
        <select {...fieldProps(this.props, { className: ["field", "selectfield", "with-icon"] })} value={this.getUIState()} onChange={this.onChange}>
          {this.props.choices.map((choice: SelectOption) => {
            return <Localized id={choice.l10n} key={choice.value}><option value={choice.value}/></Localized>;
          })}
        </select>
      </React.Fragment>;
    } else {
      return <select {...fieldProps(this.props, { className: ["field", "selectfield"] })} value={this.getUIState()} onChange={this.onChange}>
        {this.props.choices.map((choice: SelectOption) => {
          return <Localized id={choice.l10n} key={choice.value}><option value={choice.value}/></Localized>;
        })}
      </select>;
    }
  }
}
