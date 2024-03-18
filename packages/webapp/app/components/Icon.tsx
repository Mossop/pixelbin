import { Link } from "@remix-run/react";
import { RemixLinkProps } from "@remix-run/react/dist/components";
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
  className,
  onClick,
  ...props
}: {
  icon: IconName;
} & RemixLinkProps &
  React.RefAttributes<HTMLAnchorElement>) {
  let clicked = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.stopPropagation();
      if (onClick) {
        onClick(event);
      }
    },
    [onClick],
  );

  return (
    <Link className="c-icon-link" onClick={clicked} {...props}>
      <WrappedIcon icon={icon} className={className} />
    </Link>
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
      name={icon}
      onClick={clicked}
    />
  );
}

export default WrappedIcon;
