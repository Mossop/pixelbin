import React from "react";

import Textbox from "./Textbox";

interface TextFieldProps {
  uiPath: string;
  disabled: boolean;
  type?: string;
  required?: boolean;
}

export default class TextField extends React.Component<TextFieldProps> {
  private field: React.RefObject<Textbox>;

  public constructor(props: TextFieldProps) {
    super(props);
    this.field = React.createRef();
  }

  public focus(): void {
    if (this.field.current) {
      this.field.current.focus();
    }
  }

  public render(): React.ReactNode {
    return <React.Fragment>
      <p className="fieldLabel"><label htmlFor={this.props.uiPath}>{this.props.children}</label></p>
      <Textbox type={this.props.type || "text"} id={this.props.uiPath} required={!!this.props.required} ref={this.field} uiPath={this.props.uiPath} disabled={this.props.disabled}/>
    </React.Fragment>;
  }
}
