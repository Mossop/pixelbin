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

export abstract class UIManager<P, S = object> extends React.Component<P, S> {
  private uiState: Map<string, ComponentState>;

  private getUIState: (path: string) => ComponentState | undefined = (path: string): ComponentState | undefined => {
    return this.uiState.get(path);
  };

  private setUIState: (path: string, state: ComponentState | undefined) => void = (path: string, state: ComponentState | undefined): void => {
    if (state) {
      this.uiState.set(path, state);
    } else {
      this.uiState.delete(path);
    }

    this.forceUpdate();
  };

  public constructor(props: P) {
    super(props);

    this.uiState = new Map();
  }

  protected getTextState(path: string): string {
    return getTextState(this.getUIState(path));
  }

  protected setTextState(path: string, state: string): void {
    this.setUIState(path, { text: state });
  }

  protected abstract renderUI(): React.ReactNode;

  public render(): React.ReactNode {
    let context: UIContext = {
      getState: this.getUIState,
      setState: this.setUIState,
    };
    return <Context.Provider value={context}>{this.renderUI()}</Context.Provider>;
  }
}

export interface ComponentProps {
  uiPath: string;
}

export abstract class TextComponent<P, S = object> extends React.Component<P & ComponentProps, S> {
  public static contextType: React.Context<UIContext> = Context;
  public context!: React.ContextType<typeof Context>;

  protected getUIState(): string {
    return getTextState(this.context.getState(this.props.uiPath));
  }

  protected setUIState(state: string): void {
    this.context.setState(this.props.uiPath, { text: state });
  }
}
