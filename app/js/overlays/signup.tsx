import React from "react";
import { connect } from "react-redux";

import { signup } from "../api/auth";
import TextField from "../components/TextField";
import { UIManager } from "../utils/uicontext";

import { DispatchProps, completeSignup } from "../utils/actions";
import { Overlay, OverlayType } from "../types";

export function isSignupOverlay(state: Overlay): boolean {
  return state.type === OverlayType.Signup;
}

interface SignupState {
  disabled: boolean;
  failed: boolean;
}

const mapDispatchToProps = {
  completeSignup: completeSignup,
};

type SignupProps = DispatchProps<typeof mapDispatchToProps>;

class SignupOverlay extends UIManager<SignupProps, SignupState> {
  private emailBox: React.RefObject<TextField>;

  public constructor(props: SignupProps) {
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
    let name = this.getTextState("name");
    let password = this.getTextState("password");

    if (!email) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let state = await signup(email, name || "", password || "");
      this.props.completeSignup(state);
    } catch (e) {
      this.setState({ disabled: false, failed: true });
    }
  };

  public renderUI(): React.ReactNode {
    let title = this.state.failed ?
      <p className="error formTitle">There is already an account with this email. Try again:</p> :
      <p className="formTitle">Enter your details:</p>;

    return <div className="centerblock">
      <form id="signupForm" className="fieldGrid" onSubmit={this.onSubmit}>
        {title}
        <TextField uiPath="email" required={true} type="email" ref={this.emailBox} disabled={this.state.disabled}>Email address:</TextField>
        <TextField uiPath="name" disabled={this.state.disabled}>Name:</TextField>
        <TextField uiPath="password" type="password" disabled={this.state.disabled}>Password:</TextField>
        <p className="spanEnd"><input type="submit" value="Log In" disabled={this.state.disabled}/></p>
      </form>
    </div>;
  }
}

export default connect(null, mapDispatchToProps)(SignupOverlay);
