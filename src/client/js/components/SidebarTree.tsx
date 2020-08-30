import { useLocalization } from "@fluent/react";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import AddIcon from "@material-ui/icons/Add";
import React, { useCallback } from "react";

import { useActions } from "../store/actions";
import { VirtualItem } from "../utils/virtual";
import Link from "./Link";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    icon: {
      paddingRight: theme.spacing(1),
      minWidth: theme.spacing(1) + 24,
    },
    nested: {
      paddingLeft: theme.spacing(2),
    },
  }));

function SidebarTreeItem({ item }: { item: VirtualItem }): React.ReactElement | null {
  const { l10n } = useLocalization();
  const classes = useStyles();

  let children = item.children;
  let icon = item.icon();

  return <React.Fragment>
    <ListItem dense={true}>
      {
        icon && <ListItemIcon className={classes.icon}>
          {icon}
        </ListItemIcon>
      }
      <ListItemText>
        {
          item.link ?
            <Link color="inherit" to={item.link}>{item.label(l10n)}</Link> :
            item.label(l10n)
        }
      </ListItemText>
    </ListItem>
    {
      children.length ?
        <List component="div" disablePadding={true} className={classes.nested}>
          {
            children.map((item: VirtualItem) => {
              return <SidebarTreeItem key={item.id} item={item}/>;
            })
          }
        </List> :
        null
    }
  </React.Fragment>;
}

export default function SidebarTree(
  { roots }: { roots: VirtualItem[] },
): React.ReactElement | null {
  const actions = useActions();
  const { l10n } = useLocalization();

  const onCreateCatalog = useCallback(() => {
    actions.showCatalogCreateOverlay();
  }, [actions]);

  return <List component="nav">
    {
      roots.map((root: VirtualItem): React.ReactElement | null => {
        return <SidebarTreeItem key={root.id} item={root}/>;
      })
    }
    <ListItem dense={true} button={true} onClick={onCreateCatalog}>
      <ListItemIcon>
        <AddIcon/>
      </ListItemIcon>
      <ListItemText>
        {l10n.getString("sidebar-add-catalog")}
      </ListItemText>
    </ListItem>
  </List>;
}
