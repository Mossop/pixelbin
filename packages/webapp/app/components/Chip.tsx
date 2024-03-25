import { Link } from "@remix-run/react";
import { SlTag } from "shoelace-react";

import Icon, { IconName } from "./Icon";

import "styles/components/Chip.scss";

export default function Chip({
  icon,
  to,
  replace,
  state,
  children,
}: {
  icon: IconName;
  to?: string;
  replace?: boolean;
  state?: any;
  children: React.ReactNode;
}) {
  if (to) {
    return (
      <Link to={to} replace={replace} state={state}>
        <SlTag pill size="small" className="c-chip">
          <Icon icon={icon} />
          {children}
        </SlTag>
      </Link>
    );
  }

  return (
    <SlTag pill size="small" className="c-chip">
      <Icon icon={icon} />
      {children}
    </SlTag>
  );
}
