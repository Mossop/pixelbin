import React from "react";

interface Props {
  onClick: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}

export class Button extends React.Component<Props> {
  public render(): React.ReactNode {
    return (
      <a onClick={this.props.onClick}>
        {this.props.children}
      </a>
    );
  }
}
