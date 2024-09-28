import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet, useLoaderData, useNavigate } from "@remix-run/react";
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

function SubscribeButton({ search }: { search: SavedSearch }) {
  let [dialogShown, setDialogShown] = useState(false);

  let [email, setEmail] = useState("");
  let [submitting, setSubmitting] = useState(false);

  let submit = useCallback(() => {
    if (email == "") {
      return;
    }

    setSubmitting(true);
    let formData = new FormData();
    formData.append("email", email);
    formData.append("search", search.id);

    fetch("/subscribe", {
      method: "POST",
      body: formData,
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
        console.error(error);
      })
      .finally(() => setSubmitting(false));
  }, [email, search]);

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
      <IconButton icon="subscribe" onClick={() => setDialogShown(true)} />
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
}: LoaderFunctionArgs) {
  let session = await getRequestContext(request, context);
  let search = await getSearch(session, id!);

  return json({ title: search.name, search });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (data) {
    return [{ title: data.title }];
  }
  return [];
};

export default function SearchLayout() {
  let { search } = useLoaderData<typeof loader>();
  let navigate = useNavigate();

  let requestStream = useCallback(
    (signal: AbortSignal) =>
      fetch(`/api/search/${search.id}/media`, { signal }),
    [search],
  );

  let setQuery = useCallback(
    (query: SearchQuery) => {
      let params = new URLSearchParams({ q: JSON.stringify(query) });
      navigate(`${url(["catalog", search.catalog, "search"])}?${params}`, {
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
