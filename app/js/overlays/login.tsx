import React from "react";
import { connect } from "react-redux";

import { login } from "../api/auth";
import Textbox from "../components/Textbox";
import { UIManager } from "../utils/uicontext";

import { DispatchProps, completeLogin } from "../utils/actions";
import { Overlay, OverlayType } from "../types";

export function isLoginOverlay(state: Overlay): boolean {
  return state.type === OverlayType.Login;
}

interface LoginState {
  disabled: boolean;
  failed: boolean;
}

const mapDispatchToProps = {
  completeLogin: completeLogin,
};

type LoginProps = DispatchProps<typeof mapDispatchToProps>;

class LoginOverlay extends UIManager<LoginProps, LoginState> {
  private emailBox: React.RefObject<Textbox>;

  public constructor(props: LoginProps) {
    super(props);
    this.state = {
      disabled: false,
      failed: false,
    };

    this.emailBox = React.createRef();
  }

  public componentDidMount(): void {
    if (this.emailBox.current) {
      this.emailBox.current.focus();
    }
  }

  private onSubmit: ((event: React.FormEvent<HTMLFormElement>) => Promise<void>) = async(event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    let email = this.getTextState("email");
    let password = this.getTextState("password");
    if (!email) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let state = await login(email, password);
      this.props.completeLogin(state);
    } catch (e) {
      this.setState({ disabled: false, failed: true });

      this.setTextState("email", "");
      this.setTextState("password", "");
    }
  };

  public renderUI(): React.ReactNode {
    let title = this.state.failed ?
      <p className="error" style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>Unknown email or password. Try again:</p> :
      <p style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>Please enter your login details:</p>;

    return <div className="centerblock">
      <form id="loginForm" className="fieldGrid" onSubmit={this.onSubmit}>
        {title}
        <p className="rightAlign"><label htmlFor="email">Email address:</label></p>
        <Textbox type="email" id="email" ref={this.emailBox} uiPath="email" disabled={this.state.disabled}/>
        <p className="rightAlign"><label htmlFor="password">Password:</label></p>
        <Textbox type="password" id="password" uiPath="password" disabled={this.state.disabled}/>
        <p style={{ gridColumn: "span 2", justifySelf: "end" }}><input id="" type="submit" value="Log In" disabled={this.state.disabled}/></p>
      </form>
    </div>;
  }
}

export default connect(null, mapDispatchToProps)(LoginOverlay);
