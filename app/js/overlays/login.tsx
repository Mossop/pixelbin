import React from "react";
import { connect } from "react-redux";

import { login } from "../api/auth";
import { DispatchProps, completeLogin } from "../store/actions";
import Overlay from "../components/overlay";
import { APIError } from "../api/types";
import Form, { FormField } from "../components/Form";
import { proxyReactState, makeProperty } from "../utils/StateProxy";
import { focus } from "../utils/helpers";

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

class LoginOverlay extends React.Component<LoginProps, LoginState> {
  private inputs: Inputs;

  public constructor(props: LoginProps) {
    super(props);
    this.state = {
      disabled: false,
      inputs: {
        email: "",
        password: "",
      }
    };

    this.inputs = proxyReactState(this, "inputs");
  }

  public componentDidMount(): void {
    focus("login-overlay-email");
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let email = this.inputs.email;
    let password = this.inputs.password;
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
      });
      this.inputs.password = "";
      focus("login-overlay-password");
    }
  };

  public render(): React.ReactNode {
    return <Overlay title="login-title" error={this.state.error}>
      <Form orientation="column" disabled={this.state.disabled} onSubmit={this.onSubmit} submit="login-submit">
        <FormField id="login-overlay-email" type="email" labelL10n="login-email" iconName="at" required={true} disabled={this.state.disabled} property={makeProperty(this.inputs, "email")}/>
        <FormField id="login-overlay-password" type="password" labelL10n="login-password" iconName="key" disabled={this.state.disabled} property={makeProperty(this.inputs, "password")}/>
      </Form>
    </Overlay>;
  }
}

export default connect(null, mapDispatchToProps)(LoginOverlay);
