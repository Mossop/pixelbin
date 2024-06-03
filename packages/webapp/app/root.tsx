import { LinksFunction, LoaderFunctionArgs, json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";

import AppBar from "./components/AppBar";
import CastManager from "./components/CastManager";
import NotFound from "./components/NotFound";
import SidebarLayout from "./components/SidebarLayout";
import { config, state } from "./modules/api";
import { getSession } from "./modules/session";

import "styles/main.scss";

export const links: LinksFunction = () => [
  {
    rel: "shortcut icon",
    href: "/favicon.svg",
    type: "image/svg",
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  let session = await getSession(request);
  let serverConfig = await config();
  let serverState = await state(session);

  return json({ serverState, serverConfig });
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
        <link rel="stylesheet" href="/base.css" />
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

export function ErrorBoundary() {
  let error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status == 404) {
      return <NotFound />;
    }

    return `${error.status} ${error.statusText}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `Unknown Error: ${error}`;
}

export default function App() {
  return <Outlet />;
}
