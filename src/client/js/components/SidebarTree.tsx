import { useLocalization } from "@fluent/react";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import React from "react";

import { VirtualItem } from "../utils/virtual";
import Link from "./Link";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
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
        icon && <ListItemIcon>
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
  return <List component="nav">
    {
      roots.map((root: VirtualItem): React.ReactElement | null => {
        return <SidebarTreeItem key={root.id} item={root}/>;
      })
    }
  </List>;
}
