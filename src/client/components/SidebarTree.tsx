import { useLocalization } from "@fluent/react";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import { useCallback } from "react";

import { nameSorted } from "../../utils/sort";
import type { Album, Catalog, Reference, SavedSearch } from "../api/highlevel";
import { refIs, useCatalogs } from "../api/highlevel";
import { DialogType } from "../dialogs/types";
import AlbumIcon from "../icons/AlbumIcon";
import AlbumsIcon from "../icons/AlbumsIcon";
import CatalogAddIcon from "../icons/CatalogAddIcon";
import CatalogIcon from "../icons/CatalogIcon";
import SavedSearchesIcon from "../icons/SavedSearchesIcon";
import SavedSearchIcon from "../icons/SavedSearchIcon";
import { PageType } from "../pages/types";
import { useActions } from "../store/actions";
import type { UIState } from "../store/types";
import { buildURL } from "../utils/history";
import { fromUIState } from "../utils/navigation";
import type { ReactResult } from "../utils/types";
import { ReactMemo } from "../utils/types";

interface StyleProps {
  depth: number;
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    icon: {
      paddingRight: theme.spacing(1),
      minWidth: theme.spacing(1) + 24,
      fontSize: theme.typography.pxToRem(24),
    },
    item: ({ depth }: StyleProps) => ({
      paddingLeft: theme.spacing(2 + depth * 2),
    }),
    unselectableItem: {
      cursor: "default",
    },
    selectedItem: {
      backgroundColor: theme.palette.text.secondary,
      color: theme.palette.getContrastText(theme.palette.text.secondary),
      cursor: "default",
    },
    selectableItem: {
      cursor: "pointer",
    },
  }));

interface SidebarItemProps {
  selected?: boolean;
  icon: React.ReactElement;
  depth: number;
  label: string;
  children?: React.ReactNode;
  targetUIState?: UIState;
  onClick?: (event: React.MouseEvent) => void;
}

function SidebarItem({
  selected,
  icon,
  depth,
  label,
  targetUIState,
  onClick,
  children,
}: SidebarItemProps): ReactResult {
  let actions = useActions();
  let classes = useStyles({ depth });

  let className = clsx(
    classes.item,
    selected && classes.selectedItem,
    !selected && (onClick || targetUIState) ? classes.selectableItem : classes.unselectableItem,
  );

  let click = useCallback((event: React.MouseEvent) => {
    if (onClick) {
      onClick(event);
    }

    if (event.defaultPrevented || event.button != 0) {
      return;
    }

    if (targetUIState) {
      event.preventDefault();
      actions.pushUIState(targetUIState);
    }
  }, [targetUIState, actions, onClick]);

  let content = <>
    <ListItemIcon className={classes.icon}>
      {icon}
    </ListItemIcon>
    <ListItemText>
      {label}
    </ListItemText>
  </>;

  let childItems = children && <List component="div" disablePadding={true}>
    {children}
  </List>;

  if (targetUIState && !selected) {
    return <>
      <ListItem
        dense={true}
        className={className}
        button={true}
        component="a"
        href={buildURL(fromUIState(targetUIState))}
        onClick={click}
      >
        {content}
      </ListItem>
      {childItems}
    </>;
  } else if (onClick && !selected) {
    return <>
      <ListItem
        dense={true}
        className={className}
        button={true}
        onClick={click}
      >
        {content}
      </ListItem>
      {childItems}
    </>;
  } else {
    return <>
      <ListItem
        dense={true}
        className={className}
        component="div"
        onClick={click}
      >
        {content}
      </ListItem>
      {childItems}
    </>;
  }
}

interface AlbumItemProps {
  album: Album;
  depth: number;
  selectedItem?: Reference<unknown>;
}

const AlbumItem = ReactMemo(function AlbumItem({
  album,
  depth,
  selectedItem,
}: AlbumItemProps): ReactResult {
  let innerAlbums = album.children;
  let children: React.ReactNode = null;
  if (innerAlbums.length) {
    children = nameSorted(innerAlbums).map((innerAlbum: Album) => <AlbumItem
      key={innerAlbum.id}
      album={innerAlbum}
      depth={depth + 1}
      selectedItem={selectedItem}
    />);
  }

  return <SidebarItem
    targetUIState={
      {
        page: {
          type: PageType.Album,
          album: album.ref(),
        },
      }
    }
    selected={refIs(album.id, selectedItem)}
    label={album.name}
    icon={<AlbumIcon/>}
    depth={depth}
  >
    {children}
  </SidebarItem>;
});

interface SavedSearchItemProps {
  search: SavedSearch;
  depth: number;
  selectedItem?: Reference<unknown>;
}

const SavedSearchItem = ReactMemo(function SavedSearchItem({
  search,
  depth,
  selectedItem,
}: SavedSearchItemProps): ReactResult {
  return <SidebarItem
    targetUIState={
      {
        page: {
          type: PageType.SavedSearch,
          search: search.ref(),
        },
      }
    }
    selected={refIs(search.id, selectedItem)}
    label={search.name}
    icon={<SavedSearchIcon/>}
    depth={depth}
  />;
});

interface SavedSearchesItemProps {
  searches: SavedSearch[];
  selectedItem?: Reference<unknown>;
}

function SavedSearchesItem({
  searches,
  selectedItem,
}: SavedSearchesItemProps): ReactResult {
  let { l10n } = useLocalization();

  return <SidebarItem
    label={l10n.getString("catalog-searches")}
    icon={<SavedSearchesIcon/>}
    depth={1}
  >
    {
      searches.map((search: SavedSearch) => <SavedSearchItem
        key={search.id}
        search={search}
        depth={2}
        selectedItem={selectedItem}
      />)
    }
  </SidebarItem>;
}

interface AlbumsItemProps {
  albums: Album[];
  selectedItem?: Reference<unknown>;
}

function AlbumsItem({
  albums,
  selectedItem,
}: AlbumsItemProps): ReactResult {
  let { l10n } = useLocalization();

  return <SidebarItem
    label={l10n.getString("catalog-albums")}
    icon={<AlbumsIcon/>}
    depth={1}
  >
    {
      albums.map((album: Album) => <AlbumItem
        key={album.id}
        album={album}
        depth={2}
        selectedItem={selectedItem}
      />)
    }
  </SidebarItem>;
}

interface CatalogItemProps {
  catalog: Catalog;
  selectedItem?: Reference<unknown>;
}

const CatalogItem = ReactMemo(function CatalogItem({
  catalog,
  selectedItem,
}: CatalogItemProps): ReactResult {
  let searches = nameSorted(catalog.searches);
  let albums = nameSorted(catalog.rootAlbums);

  let children: React.ReactNode = null;
  if (searches.length && albums.length) {
    children = <>
      <SavedSearchesItem
        searches={searches}
        selectedItem={selectedItem}
      />
      <AlbumsItem
        albums={albums}
        selectedItem={selectedItem}
      />
    </>;
  } else if (searches.length) {
    children = searches.map((search: SavedSearch) => <SavedSearchItem
      key={search.id}
      depth={1}
      search={search}
      selectedItem={selectedItem}
    />);
  } else if (albums.length) {
    children = albums.map((album: Album) => <AlbumItem
      key={album.id}
      depth={1}
      album={album}
      selectedItem={selectedItem}
    />);
  }

  return <SidebarItem
    targetUIState={
      {
        page: {
          type: PageType.Catalog,
          catalog: catalog.ref(),
        },
      }
    }
    label={catalog.name}
    icon={<CatalogIcon/>}
    selected={refIs(catalog.id, selectedItem)}
    depth={0}
  >
    {children}
  </SidebarItem>;
});

export interface SidebarTreeProps {
  selectedItem?: Reference<unknown>;
}

export default ReactMemo(function SidebarTree({
  selectedItem,
}: SidebarTreeProps): ReactResult {
  let actions = useActions();
  let { l10n } = useLocalization();
  let catalogs = useCatalogs();

  let onCreateCatalog = useCallback(() => {
    actions.showDialog({
      type: DialogType.CatalogCreate,
    });
  }, [actions]);

  return <List id="sidebar-tree" component="div">
    {
      catalogs.map((catalog: Catalog): ReactResult => {
        return <CatalogItem key={catalog.id} catalog={catalog} selectedItem={selectedItem}/>;
      })
    }
    <SidebarItem
      icon={<CatalogAddIcon/>}
      depth={0}
      label={l10n.getString("sidebar-add-catalog")}
      onClick={onCreateCatalog}
    />
  </List>;
});
