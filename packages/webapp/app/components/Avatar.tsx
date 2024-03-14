import { useFetcher } from "@remix-run/react";
import md5 from "md5";
import { FormEvent, useCallback, useState } from "react";

import Button from "./Button";
import Dialog from "./Dialog";
import TextField from "./TextField";

import "styles/components/Avatar.scss";

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

  let [email, setEmail] = useState("");
  let [password, setPassword] = useState("");

  let performLogin = useCallback(() => {
    if (email == "") {
      return;
    }

    fetcher.submit(
      { email, password },
      {
        action: "/login",
        method: "POST",
        navigate: false,
      },
    );
  }, [fetcher, email, password]);

  let closed = useCallback(() => {
    setEmail("");
    setPassword("");
    setDialogShown(false);
  }, []);

  let formSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      performLogin();
    },
    [performLogin],
  );

  let footer = (
    <>
      <Button onClick={() => setDialogShown(false)} label="Cancel" />
      <Button
        onClick={performLogin}
        type="primary"
        label="Login"
        disabled={email == ""}
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
        show={dialogShown}
        onClosed={closed}
        label="Login"
        footer={footer}
      >
        <form onSubmit={formSubmit}>
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
    <button className="c-avatar" onClick={performLogout} type="button">
      <img src={sources[0]} srcSet={sources.join(",")} />
    </button>
  );
}

export default function Avatar({ email }: { email: string | undefined }) {
  return email ? <Menu email={email} /> : <Login />;
}
