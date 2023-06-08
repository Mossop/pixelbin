import "@material/web/button/tonal-button.js";
import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/textfield/outlined-text-field.js";
import "@material/web/dialog/dialog.js";

import "./components/app-bar.js";
import "./components/avatar.js";
import { LoginDialog } from "./components/login-dialog.js";

window.login = function login() {
  LoginDialog.show();
};
