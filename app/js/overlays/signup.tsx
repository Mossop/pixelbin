import React from "react";
import { connect } from "react-redux";

import { signup } from "../api/auth";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/Overlay";
import { DispatchProps, completeSignup } from "../store/actions";
import { APIError } from "../api/types";
import { proxyReactState, makeProperty } from "../utils/StateProxy";
import { focus } from "../utils/helpers";

interface Inputs {
  email: string;
  name: string;
  password: string;
}

interface SignupState {
  disabled: boolean;
  error?: APIError;
  inputs: Inputs;
}

const mapDispatchToProps = {
  completeSignup: completeSignup,
};

type SignupProps = DispatchProps<typeof mapDispatchToProps>;

class SignupOverlay extends React.Component<SignupProps, SignupState> {
  private inputs: Inputs;

  public constructor(props: SignupProps) {
    super(props);
    this.state = {
      disabled: false,
      inputs: {
        email: "",
        name: "",
        password: "",
      },
    };

    this.inputs = proxyReactState(this, "inputs");
  }

  public componentDidMount(): void {
    focus("signup-overlay-email");
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let email = this.inputs.email;
    let name = this.inputs.name;
    let password = this.inputs.password;

    if (!email) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let state = await signup(email, name || "", password || "");
      this.props.completeSignup(state);
    } catch (e) {
      this.setState({
        disabled: false,
        error: e,
      });
      this.inputs.password = "";
    }
  };

  public render(): React.ReactNode {
    return <Overlay title="signup-title" error={this.state.error}>
      <Form orientation="column" disabled={this.state.disabled} onSubmit={this.onSubmit} submit="signup-submit">
        <FormField id="signup-overlay-email" type="email" labelL10n="signup-email" iconName="at" required={true} property={makeProperty(this.inputs, "email")}/>
        <FormField id="signup-overlay-name" type="text" labelL10n="signup-name" iconName="user" property={makeProperty(this.inputs, "name")}/>
        <FormField id="signup-overlay-password" type="password" labelL10n="signup-password" iconName="key" property={makeProperty(this.inputs, "password")}/>
      </Form>
    </Overlay>;
  }
}

export default connect(null, mapDispatchToProps)(SignupOverlay);
