import React from "react";

interface TextComponentState {
  text: string;
}

function isTextState(state: ComponentState): state is TextComponentState {
  return "text" in state;
}

function getTextState(state: ComponentState | undefined): string {
  if (state && isTextState(state)) {
    return state.text;
  }
  return "";
}

type ComponentState = TextComponentState;

interface UIContext {
  getState: (path: string) => ComponentState | undefined;
  setState: (path: string, state: ComponentState | undefined) => void;
}

const Context = React.createContext<UIContext>({
  getState(): undefined {
    return undefined;
  },

  setState(): void {
    return;
  }
});

export abstract class UIManager<P = {}, S = {}> extends React.Component<P, S> {
  private uiState: Map<string, ComponentState>;
  private mounted: boolean;

  private getUIState: (path: string) => ComponentState | undefined = (path: string): ComponentState | undefined => {
    return this.uiState.get(path);
  };

  private setUIState: (path: string, state: ComponentState | undefined) => void = (path: string, state: ComponentState | undefined): void => {
    if (state) {
      this.uiState.set(path, state);
    } else {
      this.uiState.delete(path);
    }

    if (this.mounted) {
      this.forceUpdate();
    }
  };

  public constructor(props: P) {
    super(props);

    this.uiState = new Map();
    this.mounted = false;
  }

  protected getTextState(path: string): string {
    return getTextState(this.getUIState(path));
  }

  protected setTextState(path: string, state: string): void {
    this.setUIState(path, { text: state });
  }

  protected abstract renderUI(): React.ReactNode;

  public componentDidMount(): void {
    this.mounted = true;
  }

  public componentWillUnmount(): void {
    this.mounted = false;
  }

  public render(): React.ReactNode {
    let context: UIContext = {
      getState: this.getUIState,
      setState: this.setUIState,
    };
    return <Context.Provider value={context}>{this.renderUI()}</Context.Provider>;
  }
}

export interface UIComponentProps {
  uiPath: string;
}

export abstract class TextComponent<P extends UIComponentProps, S = {}> extends React.Component<P, S> {
  public static contextType: React.Context<UIContext> = Context;
  public context!: React.ContextType<typeof Context>;

  protected getUIState(): string {
    return getTextState(this.context.getState(this.props.uiPath));
  }

  protected setUIState(state: string): void {
    this.context.setState(this.props.uiPath, { text: state });
  }
}
