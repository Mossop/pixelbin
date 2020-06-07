import { Draft } from "immer";
import React, { ReactNode, PureComponent } from "react";

import actions from "../store/actions";
import type { UIState } from "../store/types";
import { ComponentProps, connect } from "../utils/component";
import { buildURL } from "../utils/history";
import { fromUIState } from "../utils/navigation";
import { Obj } from "../utils/types";

interface PassedProps {
  to: Draft<UIState>;
}

const mapDispatchToProps = {
  navigate: actions.navigate,
};

class Link extends PureComponent<ComponentProps<PassedProps, Obj, typeof mapDispatchToProps>> {
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
