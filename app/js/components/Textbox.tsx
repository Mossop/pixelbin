import React from "react";

import { UIProps, UIState, UIComponent } from "../utils/uicontext";

interface TextboxProps extends UIProps {
  id: string;
  initial?: string;
  type: string;
  disabled?: boolean;
}


export default class Textbox extends UIComponent<TextboxProps> {
  private input: React.RefObject<HTMLInputElement>;

  public constructor(props: TextboxProps) {
    super(props);

    this.input = React.createRef();
  }

  public getValue(): string {
    return this.uiState.textbox;
  }

  public focus(): void {
    if (this.input.current) {
      this.input.current.focus();
    }
  }

  private onChange: ((event: React.ChangeEvent<HTMLInputElement>) => void) = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.updateUiState((state: UIState) => {
      state.textbox = event.target.value;
    });
  };

  public render(): React.ReactNode {
    return (
      <input ref={this.input} type={this.props.type} id={this.props.id}  disabled={!!this.props.disabled} value={this.uiState.textbox} onChange={this.onChange}/>
    );
  }
}
