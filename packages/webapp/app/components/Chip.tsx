import { useNavigate } from "@remix-run/react";
import { useCallback } from "react";
import { SlButton, SlIcon } from "shoelace-react";

import { ICONS, IconName } from "./Icon";

export default function Chip({
  icon,
  to,
  replace,
  state,
  onClick,
  children,
}: {
  icon: IconName;
  to?: string;
  replace?: boolean;
  state?: any;
  onClick?: (event: React.MouseEvent) => void;
  children: React.ReactNode;
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

      if (to && (state || replace)) {
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
    <li>
      <SlButton
        pill
        size="small"
        name={ICONS[icon]}
        onClick={clicked}
        href={to}
      >
        <SlIcon slot="prefix" library="material" name={ICONS[icon]} />
        {children}
      </SlButton>
    </li>
  );
}
