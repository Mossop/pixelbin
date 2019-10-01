import React from "react";
import { Action } from "redux";
import { connect } from "react-redux";

import { login } from "../api/auth";
import Textbox from "../content/Textbox";

import { CompleteLogin } from "../utils/actions";
import { UserState, Overlay, OverlayType } from "../types";

export function isLoginOverlay(state: Overlay): boolean {
  return state.type === OverlayType.Login;
}

interface DispatchProps {
  onNewState: (state: UserState) => void;
}

interface LoginState {
  disabled: boolean;
  failed: boolean;
}

type LoginProps = DispatchProps;

const mapDispatchToProps = (dispatch: (action: Action) => void): DispatchProps => ({
  onNewState: (state: UserState): void => dispatch(new CompleteLogin(state)),
});

class LoginOverlay extends React.Component<LoginProps, LoginState> {
  private emailBox: React.RefObject<Textbox>;
  private passwordBox: React.RefObject<Textbox>;

  public constructor(props: LoginProps) {
    super(props);
    this.state = {
      disabled: false,
      failed: false,
    };

    this.emailBox = React.createRef();
    this.passwordBox = React.createRef();
  }

  private onSubmit = async(event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!this.emailBox.current || !this.passwordBox.current) {
      return;
    }

    this.setState({ disabled: true });
    this.emailBox.current.disable();
    this.passwordBox.current.disable();

    try {
      let state = await login(this.emailBox.current.getValue(), this.passwordBox.current.getValue());
      this.props.onNewState(state);
    } catch (e) {
      this.setState({ disabled: false, failed: true });
    }
  };

  public render(): React.ReactNode {
    return (
      <div className="centerblock">
        <form id="loginForm" className="fieldGrid" onSubmit={this.onSubmit}>
          <p style={{ gridColumn: "span 2", justifySelf: "start" }}>Please enter your login details:</p>
          <p className="rightAlign"><label htmlFor="email">Email address:</label></p>
          <Textbox type="email" id="email" ref={this.emailBox}/>
          <p className="rightAlign"><label htmlFor="password">Password:</label></p>
          <Textbox type="password" id="password" ref={this.passwordBox}/>
          <p style={{ gridColumn: "span 2", justifySelf: "end" }}><input id="" type="submit" value="Log In" disabled={this.state.disabled}/></p>
        </form>
      </div>
    );
  }
}

export default connect(null, mapDispatchToProps)(LoginOverlay);
