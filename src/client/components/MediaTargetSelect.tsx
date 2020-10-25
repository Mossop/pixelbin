import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { createStyles, makeStyles, Theme, useTheme } from "@material-ui/core/styles";
import React, { forwardRef, useCallback, useMemo } from "react";

import { Album, Catalog } from "../api/highlevel";
import { ReactRef, ReactResult } from "../utils/types";
import { VirtualAlbum, VirtualCatalog, VirtualItem } from "../utils/virtual";

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
  roots: VirtualItem[];
  value: Album | Catalog;
  onChange?: (selected: Album | Catalog) => void;
}

export default forwardRef(function MediaTargetSelect(
  {
    id,
    disabled,
    required,
    roots,
    value,
    onChange,
  }: MediaTargetSelectProps,
  ref: ReactRef<HTMLElement> | null,
): ReactResult {
  let { l10n } = useLocalization();
  let theme = useTheme();
  let classes = useStyles();

  interface ItemInfo {
    item: VirtualItem;
    depth: number;
    value: Album | Catalog;
  }

  let itemMap = useMemo(() => {
    let addItem = (item: VirtualItem, depth: number): void => {
      let value: Album | Catalog;
      if (item instanceof VirtualAlbum) {
        value = item.album;
      } else if (item instanceof VirtualCatalog) {
        value = item.catalog;
      } else {
        return;
      }

      itemMap.set(item.id, { item, depth, value });
      for (let child of item.children) {
        addItem(child, depth + 1);
      }
    };

    let itemMap = new Map<string, ItemInfo>();

    for (let root of roots) {
      addItem(root, 0);
    }

    return itemMap;
  }, [roots]);

  let onSelectChange = useCallback(
    (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
      if (onChange && typeof event.target.value == "string") {
        let info = itemMap.get(event.target.value);
        if (info) {
          onChange(info.value);
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
        ({ item, depth }: ItemInfo): ReactResult => {
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
              <Box className={classes.icon}>{item.icon()}</Box>
              <span>{item.label(l10n)}</span>
            </Box>
          </MenuItem>;
        },
      )
    }
  </Select>;
});
