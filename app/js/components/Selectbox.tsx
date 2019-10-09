import React from "react";

import { ComponentProps, TextComponent } from "../utils/uicontext";

interface SelectboxProps {
  id: string;
  disabled?: boolean;
  className?: string;
}

export default class Selectbox extends TextComponent<SelectboxProps & ComponentProps> {
  public constructor(props: SelectboxProps & ComponentProps) {
    super(props);
  }

  private onChange: ((event: React.ChangeEvent<HTMLSelectElement>) => void) = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this.setUIState(event.target.value);
  };

  public render(): React.ReactNode {
    return <select className={this.props.className ? this.props.className : "field"} id={this.props.id} disabled={!!this.props.disabled} value={this.getUIState()} onChange={this.onChange}>
      {this.props.children}
    </select>;
  }
}
