import * as icons from "@mdi/js";
import MDIcon from "@mdi/react";
import clsx from "clsx";

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
  info: icons.mdiInformationOutline,
  "fullscreen-enter": icons.mdiFullscreen,
  "fullscreen-exit": icons.mdiFullscreenExit,
  tag: icons.mdiTagOutline,
  person: icons.mdiAccountOutline,
};

export type IconName = keyof typeof ICONS;

function Icon({ icon, className }: { icon: IconName; className?: string }) {
  return <MDIcon className={clsx("c-icon", className)} path={ICONS[icon]} />;
}

export function IconLink({
  icon,
  className,
  ...props
}: {
  icon: IconName;
  className?: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className="c-icon-link" {...props}>
      <Icon icon={icon} className={className} />
    </a>
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
  return (
    <button className="c-icon-button" onClick={onClick}>
      <Icon icon={icon} className={className} />
    </button>
  );
}

export default Icon;
