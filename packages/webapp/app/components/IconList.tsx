import { Link } from "react-router";
import { SlBadge } from "shoelace-react";

import Icon, { IconName } from "./Icon";

import "styles/components/IconList.scss";

export function IconList({ children }: { children: React.ReactNode }) {
  return <ul className="c-iconlist">{children}</ul>;
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
  icon: IconName;
  count?: number;
  children?: React.ReactNode;
}) {
  if (href) {
    return (
      <li className="c-iconlistitem">
        <Link className={`item-label ${selected ? "selected" : ""}`} to={href}>
          <div className="item-icon">
            <Icon icon={icon} />
          </div>
          <span className="label">{label}</span>
          <span className="count">
            {count === 0 ? (
              ""
            ) : (
              <SlBadge variant="neutral" pill>
                {count}
              </SlBadge>
            )}
          </span>
        </Link>
        <div>{children}</div>
      </li>
    );
  }

  return (
    <li className="c-iconlistitem">
      <div className="item-label">
        <div className="item-icon">
          <Icon icon={icon} />
        </div>
        <span className="label">{label}</span>
        <span className="count">{count === 0 ? "" : count}</span>
      </div>
      <div>{children}</div>
    </li>
  );
}
