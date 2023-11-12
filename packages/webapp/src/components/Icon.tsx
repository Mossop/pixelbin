import clsx from "clsx";

export default function Icon({
  icon,
  onClick,
}: {
  icon: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button className="c-icon-button" onClick={onClick}>
        <i className={clsx("c-icon", `bi-${icon}`)}></i>
      </button>
    );
  }

  return <i className={clsx("c-icon", `bi-${icon}`)}></i>;
}
