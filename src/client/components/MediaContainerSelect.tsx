import Box from "@material-ui/core/Box";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles, useTheme } from "@material-ui/core/styles";
import { forwardRef, useCallback, useMemo } from "react";

import type { Album, Catalog } from "../api/highlevel";
import AlbumIcon from "../icons/AlbumIcon";
import CatalogIcon from "../icons/CatalogIcon";
import type { ReactRef, ReactResult } from "../utils/types";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    icon: {
      paddingRight: theme.spacing(1),
      minWidth: theme.spacing(1) + 24,
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      boxSizing: "border-box",
      color: theme.palette.action.active,
    },
    item: {
      display: "flex",
      justifyContent: "flex-start",
      alignItems: "center",
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  }));

export interface MediaTargetSelectProps {
  id: string;
  disabled?: boolean;
  required?: boolean;
  catalogs: Catalog[];
  currentTarget?: string | null;
  value: Album | Catalog;
  onChange?: (selected: Album | Catalog) => void;
}

export default forwardRef(function MediaTargetSelect({
  id,
  disabled,
  required,
  catalogs,
  value,
  currentTarget,
  onChange,
}: MediaTargetSelectProps, ref: ReactRef<HTMLElement> | null): ReactResult {
  let theme = useTheme();
  let classes = useStyles();

  interface ItemInfo {
    item: Album | Catalog;
    icon: React.ReactNode;
    depth: number;
  }

  let itemMap = useMemo(() => {
    let addItem = (item: Album, depth: number): void => {
      if (item.id == currentTarget) {
        return;
      }

      itemMap.set(item.id, {
        item,
        depth,
        icon: <AlbumIcon/>,
      });

      for (let child of item.children) {
        addItem(child, depth + 1);
      }
    };

    let itemMap = new Map<string, ItemInfo>();

    for (let catalog of catalogs) {
      itemMap.set(catalog.id, {
        item: catalog,
        depth: 0,
        icon: <CatalogIcon/>,
      });

      for (let album of catalog.rootAlbums) {
        addItem(album, 1);
      }
    }

    return itemMap;
  }, [catalogs, currentTarget]);

  let onSelectChange = useCallback(
    (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
      if (onChange && typeof event.target.value == "string") {
        let info = itemMap.get(event.target.value);
        if (info) {
          onChange(info.item);
        }
      }
    },
    [onChange, itemMap],
  );

  return <Select
    id={id}
    ref={ref}
    disabled={disabled}
    required={required}
    value={value.id}
    onChange={onSelectChange}
  >
    {
      Array.from(
        itemMap.values(),
        ({ item, depth, icon }: ItemInfo): ReactResult => {
          return <MenuItem
            key={item.id}
            value={item.id}
            style={
              {
                paddingLeft: theme.spacing(2) * depth,
              }
            }
          >
            <Box className={classes.item}>
              <Box className={classes.icon}>{icon}</Box>
              <span>{item.name}</span>
            </Box>
          </MenuItem>;
        },
      )
    }
  </Select>;
});
