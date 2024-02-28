import { LinksFunction, LoaderFunctionArgs, json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import AppBar from "./components/AppBar";
import SidebarLayout from "./components/SidebarLayout";
import { state } from "./modules/api";
import { getSession } from "./modules/session";

export const links: LinksFunction = () => [
  {
    rel: "shortcut icon",
    href: "/favicon.ico",
    type: "image/x-icon",
  },
  {
    rel: "shortcut icon",
    href: "/icon.svg",
    type: "image/svg",
  },
  {
    rel: "stylesheet",
    href: "/styles.css",
    type: "text/css",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  let session = await getSession(request);

  return json({ serverState: await state(session) });
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, height=device-height, initial-scale=1, minimum-scale=1, maximum-scale=1"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <AppBar />
        <SidebarLayout>{children}</SidebarLayout>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
