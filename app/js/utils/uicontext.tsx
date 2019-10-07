import React from "react";

export interface UIState {
  textbox: string;
}

export interface UIComponents {
  [path: string]: UIState;
}

export interface UIProps {
  uiPath: string;
}

const UIContext = React.createContext<UIComponents>({});

interface ProviderState {
  uiComponents: UIComponents;
}
export class UIProvider extends React.Component<object, ProviderState> {
  public constructor(props: object) {
    super(props);

    this.state = {
      uiComponents: {},
    };
  }

  public render(): React.ReactNode {
    return <UIContext.Provider value={this.state.uiComponents}>{this.props.children}</UIContext.Provider>;
  }
}

export class UIComponent<A extends UIProps> extends React.Component<A> {
  public static contextType: React.Context<UIComponents> = UIContext;

  protected constructor(props: A) {
    super(props);
  }

  protected get uiState(): Readonly<UIState> {
    if (!(this.props.uiPath in this.context)) {
      this.context[this.props.uiPath] = {
        textbox: "",
      };
    }

    return this.context[this.props.uiPath];
  }

  protected updateUiState(updater: (state: UIState) => void): void {
    updater(this.uiState);
    this.forceUpdate();
  }
}

export default UIContext;
