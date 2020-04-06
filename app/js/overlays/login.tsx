import React, { ReactNode, PureComponent } from "react";

import { login } from "../api/auth";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/Overlay";
import actions from "../store/actions";
import { connect, ComponentProps } from "../store/component";
import { AppError } from "../utils/exception";
import { focus } from "../utils/helpers";
import { proxyReactState, makeProperty } from "../utils/StateProxy";

interface InputFields {
  email: string;
  password: string;
}

const mapDispatchToProps = {
  completeLogin: actions.completeLogin,
};

interface LoginOverlayState {
  disabled: boolean;
  inputs: InputFields;
  error?: AppError;
}

type LoginOverlayProps = ComponentProps<{}, {}, typeof mapDispatchToProps>;
class LoginOverlay extends PureComponent<LoginOverlayProps, LoginOverlayState> {
  private inputs: InputFields;

  public constructor(props: LoginOverlayProps) {
    super(props);
    this.state = {
      disabled: false,
      // eslint-disable-next-line react/no-unused-state
      inputs: {
        email: "",
        password: "",
      },
    };

    this.inputs = proxyReactState(this, "inputs");
  }

  public componentDidMount(): void {
    focus("login-overlay-email");
  }

  private onSubmit: (() => Promise<void>) = async (): Promise<void> => {
    let { email } = this.inputs;
    let { password } = this.inputs;
    if (!email) {
      return;
    }

    this.setState({ disabled: true, error: undefined });

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

  public render(): ReactNode {
    return <Overlay title="login-title" error={this.state.error}>
      <Form
        orientation="column"
        disabled={this.state.disabled}
        onSubmit={this.onSubmit}
        submit="login-submit"
      >
        <FormField
          id="login-overlay-email"
          type="email"
          labelL10n="login-email"
          iconName="at"
          required={true}
          disabled={this.state.disabled}
          property={makeProperty(this.inputs, "email")}
        />
        <FormField
          id="login-overlay-password"
          type="password"
          labelL10n="login-password"
          iconName="key"
          disabled={this.state.disabled}
          property={makeProperty(this.inputs, "password")}
        />
      </Form>
    </Overlay>;
  }
}

export default connect()(LoginOverlay, undefined, mapDispatchToProps);
