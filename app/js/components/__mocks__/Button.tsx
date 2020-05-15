import React, { PropsWithChildren, ReactNode } from "react";

import { styleProps } from "../../utils/props";
import type { PassedProps } from "../Button";

export default function Button(props: PropsWithChildren<PassedProps>): ReactNode {
  let mockProps = styleProps(props, {
    className: "mock-button",
  });
  let onClick = (): void => props.onClick();

  if (props.l10n) {
    mockProps["data-l10nid"] = typeof props.l10n == "string" ? props.l10n : props.l10n.id;
  }

  if (props.iconName) {
    mockProps["data-icon"] = props.iconName;
  }
  return <div onClick={onClick} {...mockProps}>{props.children}</div>;
}
