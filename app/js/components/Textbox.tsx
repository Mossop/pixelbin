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
  private input: React.RefObject<HTMLInputElement>;

  public constructor(props: TextboxProps) {
    super(props);
    this.state = {
      disabled: !!props.disabled,
      value: props.initial ? props.initial : "",
    };

    this.input = React.createRef();
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

  public focus(): void {
    if (this.input.current) {
      this.input.current.focus();
    }
  }

  private onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ value: event.target.value });
  };

  public render(): React.ReactNode {
    return (
      <input ref={this.input} type={this.props.type} id={this.props.id} value={this.state.value} onChange={this.onChange}/>
    );
  }
}
