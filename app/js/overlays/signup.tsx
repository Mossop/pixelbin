import React from "react";
import { connect } from "react-redux";

import { signup } from "../api/auth";
import Form, { FormProps } from "../components/Form";
import { UIManager } from "../utils/UIState";
import Overlay from "../components/overlay";
import { DispatchProps, completeSignup } from "../store/actions";
import { APIError } from "../api/types";

interface SignupState {
  disabled: boolean;
  error?: APIError;
}

const mapDispatchToProps = {
  completeSignup: completeSignup,
};

type SignupProps = DispatchProps<typeof mapDispatchToProps>;

class SignupOverlay extends UIManager<SignupProps, SignupState> {
  public constructor(props: SignupProps) {
    super(props);
    this.state = {
      disabled: false,
    };
  }

  private onSubmit: (() => Promise<void>) = async(): Promise<void> => {
    let email = this.getTextState("email");
    let name = this.getTextState("name");
    let password = this.getTextState("password");

    if (!email) {
      return;
    }

    this.setState({ disabled: true });

    try {
      let state = await signup(email, name || "", password || "");
      this.props.completeSignup(state);
    } catch (e) {
      this.setState({ disabled: false, error: e });
      this.setTextState("password", "");
    }
  };

  public renderUI(): React.ReactNode {
    let form: FormProps = {
      orientation: "column",
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,

      fields: [{
        fieldType: "textbox",
        uiPath: "email",
        labelL10n: "signup-email",
        iconName: "at",
        type: "email",
        required: true,
      }, {
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "signup-name",
        iconName: "user",
      }, {
        fieldType: "textbox",
        uiPath: "password",
        labelL10n: "signup-password",
        iconName: "key",
        type: "password",
      }],
      submit: "signup-submit",
    };
    return <Overlay title="signup-title" error={this.state.error}>
      <Form {...form}/>
    </Overlay>;
  }
}

export default connect(null, mapDispatchToProps)(SignupOverlay);
