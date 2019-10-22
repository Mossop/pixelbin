import React from "react";
import { connect } from "react-redux";

import { login } from "../api/auth";
import Form, { FormProps } from "../components/Form";
import { UIManager } from "../utils/UIState";
import { DispatchProps, completeLogin } from "../store/actions";
import Overlay from "../components/overlay";
import { APIError } from "../api/types";

interface LoginState {
  disabled: boolean;
  error?: APIError;
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
      this.setState({ disabled: false, error: e });
      this.setTextState("password", "");
    }
  };

  public renderUI(): React.ReactNode {
    let form: FormProps = {
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,

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
    return <Overlay title="login-title" error={this.state.error}>
      <Form {...form}/>
    </Overlay>;
  }
}

export default connect(null, mapDispatchToProps)(LoginOverlay);
