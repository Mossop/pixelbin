import React from "react";
import { connect } from "react-redux";

import { login } from "../api/auth";
import Form, { FormProps } from "../content/Form";
import { UIManager } from "../utils/UIState";

import { DispatchProps, completeLogin } from "../store/actions";

interface LoginState {
  disabled: boolean;
  error: boolean;
}

const mapDispatchToProps = {
  completeLogin: completeLogin,
};

type LoginProps = DispatchProps<typeof mapDispatchToProps>;

class LoginOverlay extends UIManager<LoginProps, LoginState> {
  public constructor(props: LoginProps) {
    super(props);
    this.state = {
      disabled: false,
      error: false,
    };
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
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
      this.setState({ disabled: false, error: true });
      this.setTextState("password", "");
    }
  };

  public renderUI(): React.ReactNode {
    let title = this.state.error ? "login-title-failed" : "login-title";

    let form: FormProps = {
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,
      className: this.state.error ? "error" : undefined,

      title,
      fields: [{
        fieldType: "textbox",
        uiPath: "email",
        labelL10n: "login-email",
        type: "email",
        required: true,
      }, {
        fieldType: "textbox",
        uiPath: "password",
        labelL10n: "login-password",
        type: "password",
      }],
      submit: "login-submit",
    };
    return <Form {...form}/>;
  }
}

export default connect(null, mapDispatchToProps)(LoginOverlay);
