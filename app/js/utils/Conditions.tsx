import React, { Context, ReactNode, createContext, PureComponent } from "react";
import { connect } from "react-redux";

import { StoreState } from "../store";

const IfContext: Context<boolean> = createContext<boolean>(false);

export class Then extends PureComponent {
  public static contextType: Context<boolean> = IfContext;

  public render(): ReactNode {
    if (this.context) {
      return this.props.children;
    } else {
      return null;
    }
  }
}

export class Else extends PureComponent {
  public static contextType: Context<boolean> = IfContext;

  public render(): ReactNode {
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

class If extends PureComponent<IfProps & { children: ReactNode[] }> {
  public render(): ReactNode {
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
