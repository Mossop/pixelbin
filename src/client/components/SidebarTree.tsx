import { useLocalization } from "@fluent/react";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import type { Theme } from "@material-ui/core/styles";
import { createStyles, makeStyles, useTheme } from "@material-ui/core/styles";
import React, { useCallback } from "react";

import CatalogAddIcon from "../icons/CatalogAddIcon";
import { OverlayType } from "../overlays/types";
import { useActions } from "../store/actions";
import type { ReactResult } from "../utils/types";
import type { VirtualItem } from "../utils/virtual";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    icon: {
      paddingRight: theme.spacing(1),
      minWidth: theme.spacing(1) + 24,
    },
  }));

interface SidebarTreeItemProps {
  item: VirtualItem;
  depth: number;
  selectedItem?: string;
}

function SidebarTreeItem({ item, depth, selectedItem }: SidebarTreeItemProps): ReactResult {
  let { l10n } = useLocalization();
  let classes = useStyles();
  let theme = useTheme();
  let actions = useActions();

  let children = item.children;
  let icon = item.icon();
  let link = item.link;

  let navigate = useCallback(() => {
    if (link) {
      actions.navigate(link);
    }
  }, [actions, link]);

  let buttonProps = {};
  if (link) {
    buttonProps = {
      button: true,
      onClick: navigate,
    };
  }

  let color = theme.palette.text.primary;
  let backgroundColor: string | undefined = undefined;
  if (item.id == selectedItem) {
    color = theme.palette.getContrastText(theme.palette.text.secondary);
    backgroundColor = theme.palette.text.secondary;
  }

  return <React.Fragment>
    <ListItem
      {...buttonProps}
      dense={true}
      style={
        {
          paddingLeft: theme.spacing(2 + depth * 2),
          color,
          backgroundColor,
        }
      }
    >
      {
        icon && <ListItemIcon className={classes.icon}>
          {icon}
        </ListItemIcon>
      }
      <ListItemText>
        {item.label(l10n)}
      </ListItemText>
    </ListItem>
    {
      children.length
        ? <List component="div" disablePadding={true}>
          {
            children.map((item: VirtualItem) => {
              return <SidebarTreeItem
                key={item.id}
                item={item}
                depth={depth + 1}
                selectedItem={selectedItem}
              />;
            })
          }
        </List>
        : null
    }
  </React.Fragment>;
}

export interface SidebarTreeProps {
  roots: VirtualItem[];
  selectedItem?: string;
}

export default function SidebarTree(
  { roots, selectedItem }: SidebarTreeProps,
): ReactResult {
  let actions = useActions();
  let { l10n } = useLocalization();
  let classes = useStyles();

  let onCreateCatalog = useCallback(() => {
    actions.showOverlay({
      type: OverlayType.CatalogCreate,
    });
  }, [actions]);

  return <List id="sidebar-tree" component="div">
    {
      roots.map((root: VirtualItem): ReactResult => {
        return <SidebarTreeItem key={root.id} item={root} depth={0} selectedItem={selectedItem}/>;
      })
    }
    <ListItem dense={true} button={true} onClick={onCreateCatalog}>
      <ListItemIcon className={classes.icon}>
        <CatalogAddIcon/>
      </ListItemIcon>
      <ListItemText>
        {l10n.getString("sidebar-add-catalog")}
      </ListItemText>
    </ListItem>
  </List>;
}
