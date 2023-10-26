import { state } from "@/modules/api";
import { State, Catalog, SavedSearch, Album } from "@/modules/types";
import { IconList, IconListItem } from "./IconList";
import { inSpan } from "@/modules/telemetry";

type AlbumTree = Album & { albums: AlbumTree[] };

type CatalogTree = Catalog & {
  searches: SavedSearch[];
  albums: AlbumTree[];
};

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

function buildTree(state: State): CatalogTree[] {
  return inSpan("buildTree", () => {
    let findAlbums = (
      catalog: string,
      parent: string | null,
      tree: AlbumTree[],
    ) => {
      tree.push(
        ...state.albums
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
    for (let catalog of state.catalogs) {
      let tree = {
        ...catalog,
        searches: state.searches.filter(
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

function Album({ album }: { album: AlbumTree }) {
  return (
    <IconListItem
      icon="images"
      href={`/album/${album.id}`}
      label={album.name}
      count={album.media}
    >
      {album.albums.length > 0 && (
        <IconList>
          {album.albums.map((album) => (
            <Album key={album.id} album={album} />
          ))}
        </IconList>
      )}
    </IconListItem>
  );
}

function Catalog({ catalog }: { catalog: CatalogTree }) {
  return (
    <IconListItem
      icon="file-earmark-richtext"
      href={`/catalog/${catalog.id}`}
      label={catalog.name}
    >
      <IconList>
        {catalog.searches.length > 0 && (
          <IconListItem icon="search" label="Saved Searches">
            <IconList>
              {catalog.searches.map((search) => (
                <IconListItem
                  key={search.id}
                  icon="search"
                  href={`/search/${search.id}`}
                  label={search.name}
                  count={search.media}
                />
              ))}
            </IconList>
          </IconListItem>
        )}
        {catalog.albums.length > 0 && (
          <IconListItem icon="images" label="Albums">
            <IconList>
              {catalog.albums.map((album) => (
                <Album key={album.id} album={album} />
              ))}
            </IconList>
          </IconListItem>
        )}
      </IconList>
    </IconListItem>
  );
}

export default async function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let serverState = await state();

  if (serverState && serverState.catalogs.length) {
    let catalogs = buildTree(serverState);

    return (
      <div className="flex-grow-1 flex-shrink-1 d-flex flex-row overflow-hidden">
        <nav className="overflow-y-auto flex-shrink-0 text-body-secondary bg-body-tertiary border-end py-3">
          <IconList>
            {catalogs.map((catalog) => (
              <Catalog key={catalog.id} catalog={catalog} />
            ))}
          </IconList>
        </nav>
        <main className="flex-grow-1 flex-shrink-1 overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  return (
    <main className="flex-grow-1 flex-shrink-1 overflow-y-auto">
      {children}
    </main>
  );
}
