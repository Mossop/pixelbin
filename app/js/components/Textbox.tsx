import React from "react";

interface TextboxProps {
  id: string;
  initial?: string;
  type: string;
  disabled?: boolean;
}

interface TextboxState {
  disabled: boolean;
  value: string;
}

export default class Textbox extends React.Component<TextboxProps, TextboxState> {
  public constructor(props: TextboxProps) {
    super(props);
    this.state = {
      disabled: !!props.disabled,
      value: props.initial ? props.initial : "",
    };
  }

  public getValue(): string {
    return this.state.value;
  }

  public disable(): void {
    this.setState({ disabled: true });
  }

  public enable(): void {
    this.setState({ disabled: true });
  }

  private onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ value: event.target.value });
  };

  public render(): React.ReactNode {
    return (
      <input type={this.props.type} id={this.props.id} value={this.state.value} onChange={this.onChange}/>
    );
  }
}
