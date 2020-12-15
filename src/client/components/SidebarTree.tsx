import { useLocalization } from "@fluent/react";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles } from "@material-ui/core/styles";
import clsx from "clsx";
import React, { useCallback } from "react";

import type { Album, Catalog, SavedSearch } from "../api/highlevel";
import { useCatalogs } from "../api/highlevel";
import { DialogType } from "../dialogs/types";
import AlbumIcon from "../icons/AlbumIcon";
import AlbumsIcon from "../icons/AlbumsIcon";
import CatalogAddIcon from "../icons/CatalogAddIcon";
import CatalogIcon from "../icons/CatalogIcon";
import SavedSearchesIcon from "../icons/SavedSearchesIcon";
import SavedSearchIcon from "../icons/SavedSearchIcon";
import { PageType } from "../pages/types";
import { useActions } from "../store/actions";
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
  onClick?: () => void;
}

function SidebarItem({
  selected,
  icon,
  depth,
  label,
  onClick,
  children,
}: SidebarItemProps): ReactResult {
  let classes = useStyles({ depth });

  let className = clsx(
    classes.item,
    selected && classes.selectedItem,
    !selected && onClick ? classes.selectableItem : classes.unselectableItem,
  );

  let buttonProps = {};
  if (onClick && !selected) {
    buttonProps = {
      button: true,
      onClick,
    };
  }

  return <React.Fragment>
    <ListItem
      {...buttonProps}
      dense={true}
      className={className}
      component="div"
    >
      <ListItemIcon className={classes.icon}>
        {icon}
      </ListItemIcon>
      <ListItemText>
        {label}
      </ListItemText>
    </ListItem>
    {
      children && <List component="div" disablePadding={true}>
        {children}
      </List>
    }
  </React.Fragment>;
}

interface AlbumItemProps {
  album: Album;
  depth: number;
  selectedItem?: string;
}

const AlbumItem = ReactMemo(function AlbumItem({
  album,
  depth,
  selectedItem,
}: AlbumItemProps): ReactResult {
  let actions = useActions();

  let navigate = useCallback(() => {
    actions.navigate({
      page: {
        type: PageType.Album,
        album: album.ref(),
      },
    });
  }, [actions, album]);

  let innerAlbums = album.children;
  let children: React.ReactNode = null;
  if (innerAlbums.length) {
    children = innerAlbums.map((innerAlbum: Album) => <AlbumItem
      key={innerAlbum.id}
      album={innerAlbum}
      depth={depth + 1}
      selectedItem={selectedItem}
    />);
  }

  return <SidebarItem
    onClick={navigate}
    selected={album.id == selectedItem}
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
  selectedItem?: string;
}

const SavedSearchItem = ReactMemo(function SavedSearchItem({
  search,
  depth,
  selectedItem,
}: SavedSearchItemProps): ReactResult {
  let actions = useActions();

  let navigate = useCallback(() => {
    actions.navigate({
      page: {
        type: PageType.SavedSearch,
        search: search.ref(),
      },
    });
  }, [actions, search]);

  return <SidebarItem
    onClick={navigate}
    selected={search.id == selectedItem}
    label={search.name}
    icon={<SavedSearchIcon/>}
    depth={depth}
  />;
});

interface SavedSearchesItemProps {
  searches: SavedSearch[];
  selectedItem?: string;
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
  selectedItem?: string;
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
  selectedItem?: string;
}

const CatalogItem = ReactMemo(function CatalogItem({
  catalog,
  selectedItem,
}: CatalogItemProps): ReactResult {
  let actions = useActions();

  let searches = catalog.searches;
  let albums = catalog.albums;

  let navigate = useCallback(() => {
    actions.navigate({
      page: {
        type: PageType.Catalog,
        catalog: catalog.ref(),
      },
    });
  }, [actions, catalog]);

  let children: React.ReactNode = null;
  if (searches.length && albums.length) {
    children = <React.Fragment>
      <SavedSearchesItem
        searches={searches}
        selectedItem={selectedItem}
      />
      <AlbumsItem
        albums={albums}
        selectedItem={selectedItem}
      />
    </React.Fragment>;
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
    onClick={navigate}
    label={catalog.name}
    icon={<CatalogIcon/>}
    selected={catalog.id == selectedItem}
    depth={0}
  >
    {children}
  </SidebarItem>;
});

export interface SidebarTreeProps {
  selectedItem?: string;
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
