import { Location, useLocation } from "@remix-run/react";

import { IconList, IconListItem } from "./IconList";
import { useServerState } from "@/modules/hooks";
import { inSpan } from "@/modules/telemetry";
import { State, Catalog, SavedSearch, Album } from "@/modules/types";
import { url } from "@/modules/util";

import "styles/components/SidebarLayout.scss";

type AlbumTree = Album & { albums: AlbumTree[] };

type CatalogTree = Catalog & {
  searches: SavedSearch[];
  albums: AlbumTree[];
};

function isSelected(location: Location, base: string[]): boolean {
  let path = url(base);
  return location.pathname == path || location.pathname.startsWith(`${path}/`);
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

function buildTree(userState: State): CatalogTree[] {
  return inSpan("buildTree", () => {
    let findAlbums = (
      catalog: string,
      parent: string | null,
      tree: AlbumTree[],
    ) => {
      tree.push(
        ...userState.albums
          .filter(
            (album) => album.catalog === catalog && album.parent === parent,
          )
          .map((album) => ({ ...album, albums: [] })),
      );
      tree.sort(byName);

      for (let album of tree) {
        findAlbums(catalog, album.id, album.albums);
      }
    };

    let catalogs: CatalogTree[] = [];
    for (let catalog of userState.catalogs) {
      let tree = {
        ...catalog,
        searches: userState.searches.filter(
          (search) => search.catalog === catalog.id,
        ),
        albums: [],
      };

      tree.searches.sort(byName);

      findAlbums(catalog.id, null, tree.albums);

      catalogs.push(tree);
    }

    catalogs.sort(byName);
    return catalogs;
  });
}

function AlbumItem({ album }: { album: AlbumTree }) {
  let location = useLocation();

  return (
    <IconListItem
      selected={isSelected(location, ["album", album.id])}
      icon="album"
      href={url(["album", album.id])}
      label={album.name}
      count={album.media}
    >
      {album.albums.length > 0 && (
        <IconList>
          {album.albums.map((a) => (
            <AlbumItem key={a.id} album={a} />
          ))}
        </IconList>
      )}
    </IconListItem>
  );
}

function CatalogItem({ catalog }: { catalog: CatalogTree }) {
  let location = useLocation();

  return (
    <IconListItem
      icon="catalog"
      href={url(["catalog", catalog.id])}
      label={catalog.name}
      selected={isSelected(location, ["catalog", catalog.id])}
    >
      <IconList>
        {catalog.searches.length > 0 && (
          <IconListItem icon="searches" label="Saved Searches">
            <IconList>
              {catalog.searches.map((search) => (
                <IconListItem
                  key={search.id}
                  selected={isSelected(location, ["search", search.id])}
                  icon="search"
                  href={url(["search", search.id])}
                  label={search.name}
                  count={search.media}
                />
              ))}
            </IconList>
          </IconListItem>
        )}
        {catalog.albums.length > 0 && (
          <IconListItem icon="albums" label="Albums">
            <IconList>
              {catalog.albums.map((album) => (
                <AlbumItem key={album.id} album={album} />
              ))}
            </IconList>
          </IconListItem>
        )}
      </IconList>
    </IconListItem>
  );
}

export function CatalogNav({ serverState }: { serverState: State }) {
  let catalogs = buildTree(serverState);

  return (
    <nav>
      <IconList>
        {catalogs.map((catalog) => (
          <CatalogItem key={catalog.id} catalog={catalog} />
        ))}
      </IconList>
    </nav>
  );
}

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let serverState = useServerState();

  if (serverState && serverState.catalogs.length) {
    return (
      <div className="c-sidebar-layout">
        <CatalogNav serverState={serverState} />
        <main>{children}</main>
      </div>
    );
  }

  return <main className="c-sidebar-layout">{children}</main>;
}
