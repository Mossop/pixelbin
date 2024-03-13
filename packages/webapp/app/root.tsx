import { LinksFunction, LoaderFunctionArgs, json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import AppBar from "./components/AppBar";
import CastManager from "./components/CastManager";
import SidebarLayout from "./components/SidebarLayout";
import { state } from "./modules/api";
import { getSession } from "./modules/session";

import "styles/main.scss";

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
        <script src="/cast.js" />
        <script src="//www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1" />
      </head>
      <body>
        <CastManager>
          <AppBar />
          <SidebarLayout>{children}</SidebarLayout>
        </CastManager>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
