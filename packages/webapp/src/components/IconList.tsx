import Link from "next/link";

import Icon from "./Icon";

export function IconList({ children }: { children: React.ReactNode }) {
  return <ul className="iconlist p-0 m-0">{children}</ul>;
}

export function IconListItem({
  selected,
  href,
  label,
  icon,
  count = 0,
  children,
}: {
  selected?: boolean;
  href?: string;
  label: string;
  icon: string;
  count?: number;
  children?: React.ReactNode;
}) {
  if (href) {
    return (
      <li className="iconlistitem">
        <Link
          className={`item-label ${selected ? "selected" : ""}`}
          href={href}
        >
          <div className="pe-2 item-icon">
            <Icon icon={icon} />
          </div>
          <span className="label">{label}</span>
          <span className="count">{count === 0 ? "" : count}</span>
        </Link>
        <div>{children}</div>
      </li>
    );
  }

  return (
    <li className="iconlistitem">
      <div className="item-label">
        <div className="pe-2 item-icon">
          <Icon icon={icon} />
        </div>
        <span className="label">{label}</span>
        <span className="count">{count === 0 ? "" : count}</span>
      </div>
      <div>{children}</div>
    </li>
  );
}
