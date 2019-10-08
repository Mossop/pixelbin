import React from "react";

import { ComponentProps, TextComponent } from "../utils/uicontext";

interface TextboxProps {
  id: string;
  type: string;
  disabled?: boolean;
}

export default class Textbox extends TextComponent<TextboxProps & ComponentProps> {
  private input: React.RefObject<HTMLInputElement>;

  public constructor(props: TextboxProps & ComponentProps) {
    super(props);

    this.input = React.createRef();
  }

  public focus(): void {
    if (this.input.current) {
      this.input.current.focus();
    }
  }

  private onChange: ((event: React.ChangeEvent<HTMLInputElement>) => void) = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setUIState(event.target.value);
  };

  public render(): React.ReactNode {
    return (
      <input ref={this.input} type={this.props.type} id={this.props.id}  disabled={!!this.props.disabled} value={this.getUIState()} onChange={this.onChange}/>
    );
  }
}
