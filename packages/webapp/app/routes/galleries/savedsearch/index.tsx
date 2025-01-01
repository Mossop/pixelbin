import { Outlet, useLocation, useNavigate } from "react-router";
import { FormEvent, useCallback, useMemo, useState } from "react";

import { HeaderButtons } from "@/components/AppBar";
import { IconButton, IconLink } from "@/components/Icon";
import MediaGallery from "@/components/MediaGallery";
import MediaGrid from "@/components/MediaGrid";
import SearchBar from "@/components/SearchBar";
import { getRequestContext } from "@/modules/RequestContext";
import { getSearch } from "@/modules/api";
import { SavedSearch, SearchQuery } from "@/modules/types";
import { url } from "@/modules/util";
import Dialog from "@/components/Dialog";
import TextField from "@/components/TextField";
import Button from "@/components/Button";
import { showToast } from "@/modules/toast";
import { useServerConfig, useServerState } from "@/modules/hooks";

import type { Route } from "./+types/index";

function SubscribeButton({ search }: { search: SavedSearch }) {
  let [dialogShown, setDialogShown] = useState(false);
  let config = useServerConfig();
  let serverState = useServerState();

  let [email, setEmail] = useState("");
  let [submitting, setSubmitting] = useState(false);

  let startSubscription = useCallback(
    (email: string, search: string) => {
      fetch(`${config.apiUrl}api/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, search }),
      })
        .then((response) => {
          if (!response.ok) {
            return showToast(
              "danger",
              `Subscription failed: ${response.statusText}`,
              { duration: 5000 },
            );
          } else {
            setDialogShown(false);
            return showToast(
              "success",
              `Check your email for further instructions`,
              { duration: 5000 },
            );
          }
        })
        .catch((error) => {
          return showToast("danger", `Subscription failed: ${error}`, {
            duration: 5000,
          });
        })
        .finally(() => setSubmitting(false));
    },
    [config],
  );

  let submit = useCallback(() => {
    if (email == "") {
      return;
    }

    setSubmitting(true);
    startSubscription(email, search.id);
  }, [email, search, startSubscription]);

  let subscribe = useCallback(() => {
    if (serverState?.email) {
      startSubscription(serverState.email, search.id);
    } else {
      setDialogShown(true);
    }
  }, [serverState, search, startSubscription, setDialogShown]);

  let closed = useCallback(() => {
    setEmail("");
    setDialogShown(false);
  }, []);

  let formSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  let footer = (
    <>
      <Button onClick={() => setDialogShown(false)} label="Cancel" />
      <Button
        onClick={submit}
        type="primary"
        label="Subscribe"
        disabled={email == "" || submitting}
      />
    </>
  );

  return (
    <>
      <IconButton icon="subscribe" onClick={subscribe} />
      <Dialog
        show={dialogShown}
        onClosed={closed}
        label="Subscribe"
        footer={footer}
      >
        <p style={{ marginBottom: "var(--sl-spacing-medium)" }}>
          Enter your email address to receive emails when new content is added
          to &quot;{search.name}&quot;.
        </p>
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
        </form>
      </Dialog>
    </>
  );
}

export async function loader({
  request,
  context,
  params: { id },
}: Route.LoaderArgs) {
  let session = await getRequestContext(request, context);
  let search = await getSearch(session, id);

  return { title: search.name, search };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data.title }];
}

export default function SearchLayout({
  loaderData: { search },
}: Route.ComponentProps) {
  let navigate = useNavigate();
  let location = useLocation();

  let streamUrl = useMemo(() => {
    let searchParams = new URLSearchParams(location.search);
    let url = `/api/search/${search.id}/media`;
    let params = new URLSearchParams();

    if (searchParams.has("since")) {
      params.set("since", searchParams.get("since")!);
    }

    if (params.size) {
      return `${url}?${params}`;
    }

    return url;
  }, [location.search, search]);

  let requestStream = useCallback(
    (signal: AbortSignal) => fetch(streamUrl, { signal }),
    [streamUrl],
  );

  let setQuery = useCallback(
    (query: SearchQuery) => {
      let params = new URLSearchParams({ q: JSON.stringify(query) });
      void navigate(`${url(["catalog", search.catalog, "search"])}?${params}`, {
        state: { expandSearchBar: true },
      });
    },
    [navigate, search],
  );

  let searchUrl = useMemo(() => {
    let params = new URLSearchParams({ q: JSON.stringify(search.query) });
    return url(["catalog", search.catalog, "search"], params);
  }, [search]);

  return (
    <>
      <HeaderButtons>
        <SubscribeButton search={search} />
        <IconLink icon="search" to={searchUrl} />
      </HeaderButtons>
      <MediaGallery
        key={`search/${search.id}`}
        type="savedSearch"
        url={url(["search", search.id])}
        requestStream={requestStream}
      >
        <div className="search-gallery">
          <SearchBar
            catalog={search.catalog}
            searchQuery={search.query}
            setQuery={setQuery}
          />
          <div className="grid">
            <MediaGrid />
          </div>
        </div>
        <Outlet />
      </MediaGallery>
    </>
  );
}
