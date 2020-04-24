import { Draft } from "immer";
import React, { ReactNode, PureComponent } from "react";

import { UIState } from "../store";
import actions from "../store/actions";
import { ComponentProps, connect } from "../utils/component";
import { buildURL } from "../utils/history";
import { fromUIState } from "../utils/navigation";

interface PassedProps {
  to: Draft<UIState>;
}

const mapDispatchToProps = {
  navigate: actions.navigate,
};

class Link extends PureComponent<ComponentProps<PassedProps, {}, typeof mapDispatchToProps>> {
  private onClick = (event: React.MouseEvent): void => {
    this.props.navigate(this.props.to);
    event.preventDefault();
  };

  public render(): ReactNode {
    let url = buildURL(fromUIState(this.props.to));
    return <a href={url} onClick={this.onClick}>{this.props.children}</a>;
  }
}

export default connect<PassedProps>()(Link, undefined, mapDispatchToProps);
