import React from "react";

interface Props {
  style?: object;
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export class Button extends React.Component<Props> {
  public render(): React.ReactNode {
    return (
      <button style={this.props.style || {}} className="button" onClick={this.props.onClick}>
        <span>{this.props.children}</span>
      </button>
    );
  }
}
