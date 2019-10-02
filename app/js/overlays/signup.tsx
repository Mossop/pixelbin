import React from "react";
import { connect } from "react-redux";

import { signup } from "../api/auth";
import Textbox from "../components/Textbox";

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
  onNewState: completeSignup,
};

type SignupProps = DispatchProps<typeof mapDispatchToProps>;

class SignupOverlay extends React.Component<SignupProps, SignupState> {
  private emailBox: React.RefObject<Textbox>;
  private nameBox: React.RefObject<Textbox>;
  private passwordBox: React.RefObject<Textbox>;

  public constructor(props: SignupProps) {
    super(props);
    this.state = {
      disabled: false,
      failed: false,
    };

    this.emailBox = React.createRef();
    this.nameBox = React.createRef();
    this.passwordBox = React.createRef();
  }

  public componentDidMount(): void {
    if (this.emailBox.current) {
      this.emailBox.current.focus();
    }
  }

  private onSubmit = async(event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!this.emailBox.current || !this.nameBox.current || !this.passwordBox.current) {
      return;
    }

    this.setState({ disabled: true });
    this.emailBox.current.disable();
    this.nameBox.current.disable();
    this.passwordBox.current.disable();

    try {
      let state = await signup(this.emailBox.current.getValue(), this.nameBox.current.getValue(), this.passwordBox.current.getValue());
      this.props.onNewState(state);
    } catch (e) {
      this.setState({ disabled: false, failed: true });

      //this.emailBox.current.disable();
      //this.passwordBox.current.disable();
    }
  };

  public render(): React.ReactNode {
    let title = this.state.failed ?
      <p className="error" style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>There is already an account with this email. Try again:</p> :
      <p style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>Enter your details:</p>;

    return (
      <div className="centerblock">
        <form id="loginForm" className="fieldGrid" onSubmit={this.onSubmit}>
          {title}
          <p className="rightAlign"><label htmlFor="email">Email address:</label></p>
          <Textbox type="email" id="email" ref={this.emailBox}/>
          <p className="rightAlign"><label htmlFor="name">Name:</label></p>
          <Textbox type="text" id="name" ref={this.nameBox}/>
          <p className="rightAlign"><label htmlFor="password">Password:</label></p>
          <Textbox type="password" id="password" ref={this.passwordBox}/>
          <p style={{ gridColumn: "span 2", justifySelf: "end" }}><input id="" type="submit" value="Log In" disabled={this.state.disabled}/></p>
        </form>
      </div>
    );
  }
}

export default connect(null, mapDispatchToProps)(SignupOverlay);
