import React from "react";
import { connect } from "react-redux";

import { login } from "../api/auth";
import TextField from "../components/TextField";
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
  private emailBox: React.RefObject<TextField>;

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
      <p className="formTitle error" style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>Unknown email or password. Try again:</p> :
      <p className="formTitle" style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>Please enter your login details:</p>;

    return <div className="centerblock">
      <form className="fieldGrid" onSubmit={this.onSubmit}>
        {title}
        <TextField uiPath="email" required={true} type="email" ref={this.emailBox} disabled={this.state.disabled}>Email address:</TextField>
        <TextField uiPath="password" type="password" disabled={this.state.disabled}>Pasword:</TextField>
        <p className="spanEnd"><input type="submit" value="Log In" disabled={this.state.disabled}/></p>
      </form>
    </div>;
  }
}

export default connect(null, mapDispatchToProps)(LoginOverlay);
