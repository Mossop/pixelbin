import React from "react";
import { connect } from "react-redux";

import { StoreState } from "../types";

const IfContext: React.Context<boolean> = React.createContext<boolean>(false);

export class Then extends React.Component {
  public static contextType: React.Context<boolean> = IfContext;

  public render(): React.ReactNode {
    if (this.context) {
      return this.props.children;
    } else {
      return null;
    }
  }
}

export class Else extends React.Component {
  public static contextType: React.Context<boolean> = IfContext;

  public render(): React.ReactNode {
    if (!this.context) {
      return this.props.children;
    } else {
      return null;
    }
  }
}

interface IfProps {
  result: boolean;
}

class If extends React.Component<IfProps & { children: React.ReactNode[] }> {
  public render(): React.ReactNode {
    return <IfContext.Provider value={this.props.result}>{this.props.children}</IfContext.Provider>;
  }
}

type Condition = boolean | ((state: StoreState) => boolean);
interface CalcProps {
  condition: Condition;
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
