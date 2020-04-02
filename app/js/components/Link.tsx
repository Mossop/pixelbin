import React from "react";

import { navigateAction } from "../store/actions";
import { ComponentProps, connect } from "../store/component";
import { UIState } from "../store/types";
import { buildURL } from "../utils/history";
import { fromUIState } from "../utils/navigation";

interface PassedProps {
  to: UIState;
}

const mapDispatchToProps = {
  navigateAction,
};

class Link extends React.Component<ComponentProps<PassedProps, {}, typeof mapDispatchToProps>> {
  private onClick(event: React.MouseEvent): void {
    navigateAction(this.props.to);
    event.preventDefault();
  }

  public render(): React.ReactNode {
    let url = buildURL(fromUIState(this.props.to));
    return <a href={url} onClick={(event: React.MouseEvent): void => this.onClick(event)}>{this.props.children}</a>;
  }
}

export default connect<PassedProps>()(Link, undefined, mapDispatchToProps);
