import React from "react";
import { connect } from "react-redux";

import { signup } from "../api/auth";
import Textbox from "../components/Textbox";
import { UIProvider } from "../utils/uicontext";

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

  private onSubmit: ((event: React.FormEvent<HTMLFormElement>) => Promise<void>) = async(event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!this.emailBox.current || !this.nameBox.current || !this.passwordBox.current) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let state = await signup(this.emailBox.current.getValue(), this.nameBox.current.getValue(), this.passwordBox.current.getValue());
      this.props.completeSignup(state);
    } catch (e) {
      this.setState({ disabled: false, failed: true });
    }
  };

  public render(): React.ReactNode {
    let title = this.state.failed ?
      <p className="error" style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>There is already an account with this email. Try again:</p> :
      <p style={{ paddingBottom: "15px", gridColumn: "span 2", justifySelf: "start" }}>Enter your details:</p>;

    return <UIProvider>
      <div className="centerblock">
        <form id="signupForm" className="fieldGrid" onSubmit={this.onSubmit}>
          {title}
          <p className="rightAlign"><label htmlFor="email">Email address:</label></p>
          <Textbox type="email" id="email" uiPath="email" ref={this.emailBox} disabled={this.state.disabled}/>
          <p className="rightAlign"><label htmlFor="name">Name:</label></p>
          <Textbox type="text" id="name" uiPath="name" ref={this.nameBox} disabled={this.state.disabled}/>
          <p className="rightAlign"><label htmlFor="password">Password:</label></p>
          <Textbox type="password" id="password" uiPath="password" ref={this.passwordBox} disabled={this.state.disabled}/>
          <p style={{ gridColumn: "span 2", justifySelf: "end" }}><input id="" type="submit" value="Log In" disabled={this.state.disabled}/></p>
        </form>
      </div>
    </UIProvider>;
  }
}

export default connect(null, mapDispatchToProps)(SignupOverlay);
