import React from "react";
import { connect } from "react-redux";

import { StoreState } from "../types";

export class Then extends React.Component {
  public render(): React.ReactNode {
    return this.props.children;
  }
}

export class Else extends React.Component {
  public render(): React.ReactNode {
    return this.props.children;
  }
}

interface IfProps {
  result: boolean;
}

class If extends React.Component<IfProps> {
  public render(): React.ReactNode {
    let element: React.ReactNode;
    React.Children.forEach(this.props.children, (child: React.ReactNode) => {
      if (React.isValidElement(child)) {
        if (this.props.result && child.type == Then) {
          element = child;
        } else if (!this.props.result && child.type == Else) {
          element = child;
        }
      }
    });

    return element;
  }
}

type Condition = boolean | ((state: StoreState) => boolean);
interface CalcProps {
  condition: Condition;

  // Why does this need to be here?
  children: [
    React.ReactElement,
    React.ReactElement,
  ] | React.ReactElement;
}

function calculateResult(state: StoreState, props: CalcProps): IfProps {
  let { condition } = props;
  let result: boolean;
  if (typeof condition == "function") {
    result = condition(state);
  } else {
    result = condition;
  }

  return { result };
}

const ConnectedIf = connect(calculateResult)(If);

export { ConnectedIf as If };
