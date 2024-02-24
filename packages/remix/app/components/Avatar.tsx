"use client";

import { useFetcher } from "@remix-run/react";
import md5 from "md5";
import { useCallback, useState } from "react";

import Button from "./Button";
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
  let fetcher = useFetcher();
  let [dialogShown, setDialogShown] = useState(false);
  let [didLogin, setDidLogin] = useState(false);

  let [email, setEmail] = useState("");
  let [password, setPassword] = useState("");

  let performLogin = useCallback(() => {
    fetcher.submit(
      { email, password },
      {
        action: "/login",
        method: "POST",
        navigate: false,
      }
    );
  }, [fetcher, email, password]);

  let closed = useCallback(() => {
    setEmail("");
    setPassword("");
    setDialogShown(false);
    setDidLogin(false);
  }, []);

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
  let fetcher = useFetcher();

  let performLogout = useCallback(() => {
    fetcher.submit(null, {
      action: "/logout",
      method: "POST",
      navigate: true,
    });
  }, [fetcher]);

  let sources = avatarSources(email);

  return (
    <button className="c-avatar" onClick={performLogout}>
      <img src={sources[0]} srcSet={sources.join(",")} />
    </button>
  );
}

export default function Avatar({ email }: { email: string | undefined }) {
  return <div>{email ? <Menu email={email} /> : <Login />}</div>;
}