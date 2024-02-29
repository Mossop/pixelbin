import * as icons from "@mdi/js";
import { Link } from "@remix-run/react";
import { RemixLinkProps } from "@remix-run/react/dist/components";
import clsx from "clsx";
import { useCallback } from "react";

import MDIcon from "./MaterialIcon";

const ICONS = {
  catalog: icons.mdiDatabaseOutline,
  albums: icons.mdiImageMultipleOutline,
  album: icons.mdiImageMultipleOutline,
  searches: icons.mdiFolderSearchOutline,
  search: icons.mdiImageSearchOutline,
  "star-filled": icons.mdiStar,
  "star-unfilled": icons.mdiStarOutline,
  photo: icons.mdiImage,
  video: icons.mdiVideoBox,
  file: icons.mdiFile,
  hourglass: icons.mdiTimerSandEmpty,
  previous: icons.mdiArrowLeftCircle,
  next: icons.mdiArrowRightCircle,
  close: icons.mdiCloseCircle,
  download: icons.mdiDownload,
  info: icons.mdiInformation,
  "fullscreen-enter": icons.mdiFullscreen,
  "fullscreen-exit": icons.mdiFullscreenExit,
  tag: icons.mdiTagOutline,
  person: icons.mdiAccountOutline,
  play: icons.mdiPlay,
  pause: icons.mdiPause,
  menu: icons.mdiMenu,
  expand: icons.mdiArrowDownDropCircleOutline,
  collapse: icons.mdiArrowUpDropCircleOutline,
};

export type IconName = keyof typeof ICONS;

function WrappedIcon({
  icon,
  className,
}: {
  icon: IconName;
  className?: string;
}) {
  return <MDIcon className={clsx("c-icon", className)} path={ICONS[icon]} />;
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
    <button className="c-icon-button" onClick={clicked}>
      <WrappedIcon icon={icon} className={className} />
    </button>
  );
}

export default WrappedIcon;
