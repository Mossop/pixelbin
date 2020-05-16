import React, { ReactNode, PureComponent } from "react";

import { signup } from "../api/auth";
import Form, { FormField } from "../components/Form";
import Overlay from "../components/Overlay";
import actions from "../store/actions";
import { connect, ComponentProps } from "../utils/component";
import { AppError } from "../utils/exception";
import { focus } from "../utils/helpers";
import { proxyReactState, makeProperty } from "../utils/StateProxy";

interface InputFields {
  email: string;
  name: string;
  password: string;
}

const mapDispatchToProps = {
  completeSignup: actions.completeSignup,
};

interface SignupOverlayState {
  disabled: boolean;
  inputs: InputFields;
  error?: AppError;
}

type SignupOverlayProps = ComponentProps<{}, {}, typeof mapDispatchToProps>;
class SignupOverlay extends PureComponent<SignupOverlayProps, SignupOverlayState> {
  private inputs: InputFields;

  public constructor(props: SignupOverlayProps) {
    super(props);
    this.state = {
      disabled: false,
      // eslint-disable-next-line react/no-unused-state
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

  private onSubmit: (() => Promise<void>) = async (): Promise<void> => {
    let { email } = this.inputs;
    let { name } = this.inputs;
    let { password } = this.inputs;

    if (!email) {
      return;
    }

    this.setState({ disabled: true, error: undefined });

    try {
      let state = await signup({
        email,
        fullname: name,
        password: password,
      });
      this.props.completeSignup(state);
    } catch (e) {
      this.setState({
        disabled: false,
        error: e,
      });
      this.inputs.password = "";
    }
  };

  public render(): ReactNode {
    return <Overlay title="signup-title" error={this.state.error}>
      <Form
        orientation="column"
        disabled={this.state.disabled}
        onSubmit={this.onSubmit}
        submit="signup-submit"
      >
        <FormField
          id="signup-overlay-email"
          type="email"
          labelL10n="signup-email"
          iconName="at"
          required={true}
          disabled={this.state.disabled}
          property={makeProperty(this.inputs, "email")}
        />
        <FormField
          id="signup-overlay-name"
          type="text"
          labelL10n="signup-name"
          iconName="user"
          disabled={this.state.disabled}
          property={makeProperty(this.inputs, "name")}
        />
        <FormField
          id="signup-overlay-password"
          type="password"
          labelL10n="signup-password"
          iconName="key"
          disabled={this.state.disabled}
          property={makeProperty(this.inputs, "password")}
        />
      </Form>
    </Overlay>;
  }
}

export default connect()(SignupOverlay, undefined, mapDispatchToProps);
