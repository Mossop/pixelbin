import React from "react";
import { connect } from "react-redux";

import { signup } from "../api/auth";
import Form, { FormProps } from "../components/Form";
import { UIManager } from "../utils/UIState";
import Overlay from "../components/overlay";
import { DispatchProps, completeSignup } from "../store/actions";

interface SignupState {
  disabled: boolean;
  error: boolean;
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
      error: false,
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
      this.setState({ disabled: false, error: true });
      this.setTextState("password", "");
    }
  };

  public renderUI(): React.ReactNode {
    let title = this.state.error ? "signup-title-bademail" : "signup-title";

    let form: FormProps = {
      disabled: this.state.disabled,
      onSubmit: this.onSubmit,
      className: this.state.error ? "error" : undefined,

      fields: [{
        fieldType: "textbox",
        uiPath: "email",
        labelL10n: "signup-email",
        type: "email",
        required: true,
      }, {
        fieldType: "textbox",
        uiPath: "name",
        labelL10n: "signup-name",
      }, {
        fieldType: "textbox",
        uiPath: "password",
        labelL10n: "signup-password",
        type: "password",
      }],
      submit: "signup-submit",
    };
    return <Overlay title={title}>
      <Form {...form}/>
    </Overlay>;
  }
}

export default connect(null, mapDispatchToProps)(SignupOverlay);
