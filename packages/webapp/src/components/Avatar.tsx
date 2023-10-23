/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable @next/next/no-img-element */
"use client";

import md5 from "md5";
import { useCallback, useState, useTransition } from "react";

import { login, logout } from "../modules/api";
import Button from "./Button";
import { useRouter } from "next/navigation";
import Dialog from "./Dialog";
import TextField from "./TextField";

function avatarSources(email: string): string[] {
  let hash = md5(email);
  return [
    `https://www.gravatar.com/avatar/${hash}?s=40`,
    `https://www.gravatar.com/avatar/${hash}?s=60 1.5x`,
    `https://www.gravatar.com/avatar/${hash}?s=80 2x`,
  ];
}

function Login() {
  let [isPending, startTransition] = useTransition();
  let router = useRouter();
  let [dialogHidden, setDialogHidden] = useState(true);
  let [didLogin, setDidLogin] = useState(false);

  let [email, setEmail] = useState("");
  let [password, setPassword] = useState("");

  let performLogin = useCallback(
    () =>
      startTransition(async () => {
        await login(email, password);
        setDidLogin(true);
      }),
    [startTransition, email, password],
  );

  let closed = useCallback(() => {
    if (didLogin) {
      router.refresh();
    }

    setEmail("");
    setPassword("");
    setDialogHidden(true);
    setDidLogin(false);
  }, [didLogin, router]);

  let footer = (
    <div className="d-flex justify-content-end align-items-center gap-3">
      <Button
        onClick={() => setDialogHidden(true)}
        color="outline-secondary"
        label="Cancel"
      />
      <Button
        onClick={performLogin}
        label="Login"
        disabled={email == "" && password == ""}
      />
    </div>
  );

  return (
    <>
      <Button
        color="light"
        onClick={() => setDialogHidden(false)}
        label="Login"
      />
      <Dialog
        hidden={dialogHidden || didLogin}
        onClose={() => setDialogHidden(true)}
        onClosed={closed}
        header={<div>Login</div>}
        footer={footer}
      >
        <form className="d-flex flex-column align-items-stretch gap-3">
          <TextField
            id="email-field"
            autofocus
            type="email"
            name="email"
            autocomplete="email"
            label="Email Address:"
            value={email}
            onChange={setEmail}
          />
          <TextField
            id="password-field"
            type="password"
            name="password"
            autocomplete="password"
            label="Password:"
            value={password}
            onChange={setPassword}
          />
        </form>
      </Dialog>
    </>
  );
}

function Menu({ email }: { email: string }) {
  let [isPending, startTransition] = useTransition();
  let router = useRouter();

  let performLogout = useCallback(
    () =>
      startTransition(async () => {
        await logout();
        router.refresh();
      }),
    [startTransition, router],
  );

  let sources = avatarSources(email);

  return (
    <button
      onClick={performLogout}
      className="btn shadow-none border-0 m-0 p-0"
    >
      <img
        style={{ borderRadius: "50%", height: "2.5em", width: "2.5em" }}
        src={sources[0]}
        srcSet={sources.join(",")}
      />
    </button>
  );
}

export default function Avatar({ email }: { email: string | undefined }) {
  return email ? <Menu email={email} /> : <Login />;
}
