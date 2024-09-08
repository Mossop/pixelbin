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
import { getRequestContext } from "./modules/RequestContext";
import { config, state } from "./modules/api";

import "styles/main.scss";

export const links: LinksFunction = () => [
  {
    rel: "shortcut icon",
    href: "/favicon.svg",
    type: "image/svg",
  },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  let session = await getRequestContext(request, context);
  let serverConfig = await config(session);
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
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="stylesheet" href="/base.css" />
        <Meta />
        <Links />
        <script src="/cast.js" />
        <script src="//www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1" />
        <script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossOrigin=""
        />
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
