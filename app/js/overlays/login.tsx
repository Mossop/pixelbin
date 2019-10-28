import React from "react";
import { connect } from "react-redux";

import { login } from "../api/auth";
import { DispatchProps, completeLogin } from "../store/actions";
import Overlay from "../components/overlay";
import { APIError } from "../api/types";
import { ReactInputs } from "../utils/InputState";
import Form, { FormField } from "../components/Form";

interface Inputs {
  email: string;
  password: string;
}

interface LoginState {
  disabled: boolean;
  error?: APIError;
  inputs: Inputs;
}

const mapDispatchToProps = {
  completeLogin: completeLogin,
};

type LoginProps = DispatchProps<typeof mapDispatchToProps>;

class LoginOverlay extends ReactInputs<Inputs, LoginProps, LoginState> {
  public constructor(props: LoginProps) {
    super(props);
    this.state = {
      disabled: false,
      inputs: {
        email: "",
        password: "",
      }
    };
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let email = this.state.inputs.email;
    let password = this.state.inputs.password;
    if (!email) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let state = await login(email, password);
      this.props.completeLogin(state);
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
    return <Overlay title="login-title" error={this.state.error}>
      <Form orientation="column" disabled={this.state.disabled} onSubmit={this.onSubmit} submit="login-submit">
        <FormField id="email" type="email" labelL10n="login-email" iconName="at" required={true} disabled={this.state.disabled} inputs={this.getInputState("email")}/>
        <FormField id="password" type="password" labelL10n="login-password" iconName="key" disabled={this.state.disabled} inputs={this.getInputState("password")}/>
      </Form>
    </Overlay>;
  }
}

export default connect(null, mapDispatchToProps)(LoginOverlay);
