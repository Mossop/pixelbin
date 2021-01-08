import { useLocalization } from "@fluent/react";
import Avatar from "@material-ui/core/Avatar";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import { bindMenu, bindTrigger, usePopupState } from "material-ui-popup-state/hooks";
import md5 from "md5";
import { useCallback } from "react";

import { logout } from "../api/auth";
import type { UserState } from "../api/types";
import { useActions } from "../store/actions";
import type { ReactResult } from "../utils/types";

function avatarSources(user: UserState): string[] {
  let hash = md5(user.email);
  return [
    `https://www.gravatar.com/avatar/${hash}?s=40`,
    `https://www.gravatar.com/avatar/${hash}?s=60 1.5x`,
    `https://www.gravatar.com/avatar/${hash}?s=80 2x`,
  ];
}

export interface UserMenuProps {
  user: UserState;
}

export default function UserMenu({ user }: UserMenuProps): ReactResult {
  let { l10n } = useLocalization();
  let actions = useActions();
  let userMenuState = usePopupState({ variant: "popover", popupId: "user-menu" });

  let doLogout = useCallback(async (): Promise<void> => {
    userMenuState.close();
    let state = await logout();
    actions.completeLogout(state);
  }, [actions, userMenuState]);

  return <>
    <IconButton id="banner-user-menu" {...bindTrigger(userMenuState)}>
      <Avatar
        alt={user.fullname}
        srcSet={avatarSources(user).join(", ")}
        src={avatarSources(user)[0]}
      />
    </IconButton>
    <Menu
      {...bindMenu(userMenuState)}
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
      <MenuItem id="user-menu-logout" onClick={doLogout}>
        {l10n.getString("banner-logout")}
      </MenuItem>
    </Menu>
  </>;
}
