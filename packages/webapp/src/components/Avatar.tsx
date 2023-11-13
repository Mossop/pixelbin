"use client";

import md5 from "md5";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import Button from "./Button";
import Dialog from "./Dialog";
import TextField from "./TextField";
import { login, logout } from "../modules/api";

function avatarSources(email: string): string[] {
  let hash = md5(email);
  return [
    `https://www.gravatar.com/avatar/${hash}?s=40`,
    `https://www.gravatar.com/avatar/${hash}?s=60 1.5x`,
    `https://www.gravatar.com/avatar/${hash}?s=80 2x`,
  ];
}

function Login() {
  let [, startTransition] = useTransition();
  let router = useRouter();
  let [dialogShown, setDialogShown] = useState(false);
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
    setDialogShown(false);
    setDidLogin(false);
  }, [didLogin, router]);

  let footer = (
    <>
      <Button
        onClick={() => setDialogShown(true)}
        type="secondary"
        label="Cancel"
      />
      <Button
        onClick={performLogin}
        type="primary"
        label="Login"
        disabled={email == "" && password == ""}
      />
    </>
  );

  return (
    <>
      <Button
        type="primary"
        onClick={() => setDialogShown(true)}
        label="Login"
      />
      <Dialog
        show={dialogShown || didLogin}
        onClose={() => setDialogShown(false)}
        onClosed={closed}
        header={<div>Login</div>}
        footer={footer}
      >
        <form>
          <TextField
            autofocus
            type="email"
            name="email"
            autocomplete="email"
            label="Email Address:"
            value={email}
            onChange={setEmail}
          />
          <TextField
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
  let [, startTransition] = useTransition();
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
    <button onClick={performLogout}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        style={{ borderRadius: "50%", height: "2.5rem", width: "2.5rem" }}
        src={sources[0]}
        srcSet={sources.join(",")}
      />
    </button>
  );
}

export default function Avatar({ email }: { email: string | undefined }) {
  return (
    <div className="c-avatar">{email ? <Menu email={email} /> : <Login />}</div>
  );
}
