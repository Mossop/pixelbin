import IconButton from "@material-ui/core/IconButton";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { bindMenu, bindTrigger } from "material-ui-popup-state/core";
import { usePopupState } from "material-ui-popup-state/hooks";
import { useCallback } from "react";

import PageMenuIcon from "../icons/PageMenuIcon";
import type { ReactResult } from "../utils/types";
import type { PageOption } from "./Banner";

interface PageOptionsMenuProps {
  pageOptions: PageOption[];
}

export default function PageOptionsMenu({ pageOptions }: PageOptionsMenuProps): ReactResult {
  let pageOptionsState = usePopupState({ variant: "popover", popupId: "page-options" });

  let pageOptionClick = useCallback((pageOption: PageOption): void => {
    pageOptionsState.close();
    pageOption.onClick();
  }, [pageOptionsState]);

  return <>
    <IconButton {...bindTrigger(pageOptionsState)} color="inherit">
      <PageMenuIcon/>
    </IconButton>
    <Menu
      {...bindMenu(pageOptionsState)}
      anchorOrigin={
        {
          vertical: "bottom",
          horizontal: "right",
        }
      }
      transformOrigin={
        {
          vertical: "top",
          horizontal: "right",
        }
      }
      keepMounted={true}
      getContentAnchorEl={null}
    >
      {
        pageOptions.map((option: PageOption) => <MenuItem
          key={option.id}
          id={`pageoption-menu-${option.id}`}
          color="inherit"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => pageOptionClick(option)}
        >
          <ListItemIcon>
            {option.icon}
          </ListItemIcon>
          {option.label}
        </MenuItem>)
      }
    </Menu>
  </>;
}
