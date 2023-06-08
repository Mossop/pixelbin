import "./components/AppBar.js";
import "./components/Avatar.js";
import "./components/Button.js";
import "./components/Dialog.js";
import "./components/TextField.js";
import { LoginDialog } from "./components/LoginDialog.js";

window.login = function login() {
  LoginDialog.show();
};
