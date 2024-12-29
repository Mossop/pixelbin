import { Link } from "react-router";
import { SlTag, SlTagProps } from "shoelace-react";

import Icon, { IconName } from "./Icon";

import "styles/components/Chip.scss";
import { HistoryState } from "@/modules/types";

export default function Chip({
  icon,
  variant,
  to,
  replace,
  state,
  children,
}: {
  icon?: IconName;
  variant?: SlTagProps["variant"];
  to?: string;
  replace?: boolean;
  state?: HistoryState;
  children: React.ReactNode;
}) {
  if (to) {
    return (
      <Link to={to} replace={replace} state={state}>
        <SlTag pill variant={variant} size="small" className="c-chip">
          {icon && <Icon icon={icon} />}
          {children}
        </SlTag>
      </Link>
    );
  }

  return (
    <SlTag pill variant={variant} size="small" className="c-chip">
      {icon && <Icon icon={icon} />}
      {children}
    </SlTag>
  );
}
