import { state } from "@/modules/api";
import { State, Catalog, SavedSearch, Album } from "@/modules/types";
import { IconList, IconListItem } from "./IconList";
import { inSpan } from "@/modules/telemetry";
import { url } from "@/modules/util";

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

function Album({
  album,
  selectedItem,
}: {
  album: AlbumTree;
  selectedItem?: string;
}) {
  return (
    <IconListItem
      selected={selectedItem == album.id}
      icon="images"
      href={url(["album", album.id])}
      label={album.name}
      count={album.media}
    >
      {album.albums.length > 0 && (
        <IconList>
          {album.albums.map((album) => (
            <Album key={album.id} album={album} selectedItem={selectedItem} />
          ))}
        </IconList>
      )}
    </IconListItem>
  );
}

function Catalog({
  catalog,
  selectedItem,
}: {
  catalog: CatalogTree;
  selectedItem?: string;
}) {
  return (
    <IconListItem
      icon="file-earmark-richtext"
      href={url(["catalog", catalog.id])}
      label={catalog.name}
      selected={selectedItem == catalog.id}
    >
      <IconList>
        {catalog.searches.length > 0 && (
          <IconListItem icon="search" label="Saved Searches">
            <IconList>
              {catalog.searches.map((search) => (
                <IconListItem
                  key={search.id}
                  selected={selectedItem == search.id}
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
          <IconListItem icon="images" label="Albums">
            <IconList>
              {catalog.albums.map((album) => (
                <Album
                  key={album.id}
                  album={album}
                  selectedItem={selectedItem}
                />
              ))}
            </IconList>
          </IconListItem>
        )}
      </IconList>
    </IconListItem>
  );
}

export default async function SidebarLayout({
  selectedItem,
  children,
}: {
  selectedItem?: string;
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
              <Catalog
                key={catalog.id}
                catalog={catalog}
                selectedItem={selectedItem}
              />
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
