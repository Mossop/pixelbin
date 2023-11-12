import { IconList, IconListItem } from "./IconList";
import { state } from "@/modules/api";
import { inSpan } from "@/modules/telemetry";
import { State, Catalog, SavedSearch, Album } from "@/modules/types";
import { url } from "@/modules/util";

type AlbumTree = Album & { albums: AlbumTree[] };

type CatalogTree = Catalog & {
  searches: SavedSearch[];
  albums: AlbumTree[];
};

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

function AlbumItem({
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
          {album.albums.map((a) => (
            <AlbumItem key={a.id} album={a} selectedItem={selectedItem} />
          ))}
        </IconList>
      )}
    </IconListItem>
  );
}

function CatalogItem({
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
                <AlbumItem
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
      <div className="c-sidebar-layout">
        <nav>
          <IconList>
            {catalogs.map((catalog) => (
              <CatalogItem
                key={catalog.id}
                catalog={catalog}
                selectedItem={selectedItem}
              />
            ))}
          </IconList>
        </nav>
        <main>{children}</main>
      </div>
    );
  }

  return <main className="c-sidebar-layout">{children}</main>;
}
