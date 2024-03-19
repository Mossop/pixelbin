import { useNavigate } from "@remix-run/react";
import clsx from "clsx";
import { useCallback } from "react";
import { SlIcon, SlIconButton } from "shoelace-react";

import "styles/components/Icon.scss";

const ICONS = {
  catalog: "database-outline",
  albums: "image-multiple-outline",
  album: "image-multiple-outline",
  searches: "folder-search-outline",
  search: "image-search-outline",
  "star-filled": "star",
  "star-unfilled": "star-outline",
  photo: "image",
  video: "video-box",
  file: "file",
  hourglass: "timer-sand-ampty",
  previous: "arrow-left-circle",
  next: "arrow-right-circle",
  close: "close-circle",
  download: "download",
  info: "information",
  "fullscreen-enter": "fullscreen",
  "fullscreen-exit": "fullscreen-exit",
  tag: "tag-outline",
  person: "account-outline",
  play: "play",
  pause: "pause",
  menu: "menu",
  expand: "arrow-down-drop-circle-outline",
  collapse: "arrow-up-drop-circle-outline",
  delete: "delete",
};

export type IconName = keyof typeof ICONS;

function WrappedIcon({
  icon,
  className,
}: {
  icon: IconName;
  className?: string;
}) {
  return (
    <SlIcon
      className={clsx("c-icon", className)}
      library="material"
      name={ICONS[icon]}
    />
  );
}

export function IconLink({
  icon,
  to,
  replace = false,
  state,
  className,
  download,
  onClick,
}: {
  icon: IconName;
  to: string;
  className?: string;
  download?: string;
  replace?: boolean;
  state?: any;
  onClick?: (event: React.MouseEvent) => void;
}) {
  let navigate = useNavigate();

  let clicked = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (onClick) {
        onClick(event);
      }

      if (event.defaultPrevented) {
        return;
      }

      if (state || replace) {
        event.preventDefault();

        navigate(to, {
          replace,
          state,
        });
      }
    },
    [onClick, to, state, replace, navigate],
  );

  return (
    <SlIconButton
      className={clsx("c-icon-button", className)}
      library="material"
      name={ICONS[icon]}
      onClick={clicked}
      href={to}
      download={download}
    />
  );
}

export function IconButton({
  icon,
  className,
  onClick,
}: {
  icon: IconName;
  className?: string;
  onClick: () => void;
}) {
  let clicked = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      onClick();
    },
    [onClick],
  );

  return (
    <SlIconButton
      className={clsx("c-icon-button", className)}
      library="material"
      name={ICONS[icon]}
      onClick={clicked}
    />
  );
}

export default WrappedIcon;
