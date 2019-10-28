import React from "react";
import { connect } from "react-redux";

import { signup } from "../api/auth";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/overlay";
import { DispatchProps, completeSignup } from "../store/actions";
import { APIError } from "../api/types";
import { ReactInputs } from "../utils/InputState";

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

class SignupOverlay extends ReactInputs<Inputs, SignupProps, SignupState> {
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
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let email = this.state.inputs.email;
    let name = this.state.inputs.name;
    let password = this.state.inputs.password;

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
        inputs: {
          ...this.state.inputs,
          password: "",
        },
      });
    }
  };

  public render(): React.ReactNode {
    return <Overlay title="signup-title" error={this.state.error}>
      <Form orientation="column" disabled={this.state.disabled} onSubmit={this.onSubmit} submit="signup-submit">
        <FormField id="email" type="email" labelL10n="signup-email" iconName="at" required={true} inputs={this.getInputState("email")}/>
        <FormField id="name" type="text" labelL10n="signup-name" iconName="user" inputs={this.getInputState("name")}/>
        <FormField id="password" type="password" labelL10n="signup-password" iconName="key" inputs={this.getInputState("password")}/>
      </Form>
    </Overlay>;
  }
}

export default connect(null, mapDispatchToProps)(SignupOverlay);
