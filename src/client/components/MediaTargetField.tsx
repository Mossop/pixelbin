import { useLocalization } from "@fluent/react";
import Box from "@material-ui/core/Box";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { createStyles, makeStyles, Theme, useTheme } from "@material-ui/core/styles";
import React, { forwardRef, useCallback, useMemo } from "react";

import { Album, Catalog } from "../api/highlevel";
import { ReactResult } from "../utils/types";
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

export interface MediaTargetFieldProps {
  id: string;
  disabled?: boolean;
  roots: VirtualItem[];
  value: Album | Catalog;
  onChange?: (selected: Album | Catalog) => void;
}

function MediaTargetField(
  props: MediaTargetFieldProps,
  ref: ((instance: HTMLElement | null) => void) | React.MutableRefObject<HTMLElement | null> | null,
): ReactResult {
  const { l10n } = useLocalization();
  const theme = useTheme();
  const classes = useStyles();

  interface ItemInfo {
    item: VirtualItem;
    depth: number;
    value: Album | Catalog;
  }

  let itemMap = useMemo(() => {
    const addItem = (item: VirtualItem, depth: number): void => {
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

    for (let root of props.roots) {
      addItem(root, 0);
    }

    return itemMap;
  }, [props.roots]);

  const onChange = useCallback(
    (event: React.ChangeEvent<{ name?: string; value: unknown }>): void => {
      if (props.onChange && typeof event.target.value == "string") {
        let info = itemMap.get(event.target.value);
        if (info) {
          props.onChange(info.value);
        }
      }
    },
    [props, itemMap],
  );

  return <Select
    id={props.id}
    ref={ref}
    disabled={props.disabled}
    value={props.value.id}
    onChange={onChange}
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
}

export default forwardRef(MediaTargetField);