import React, { PropsWithChildren, ReactNode, HTMLAttributes } from "react";

import type { PassedProps } from "../Button";

export default function Button(props: PropsWithChildren<PassedProps>): ReactNode {
  let mockProps: HTMLAttributes<HTMLDivElement> = {
    className: "mock-button",
    onClick: (): void => props.onClick(),
  };
  if ("id" in props) {
    mockProps.id = props.id;
  }
  if (props.l10n) {
    mockProps["data-l10nid"] = typeof props.l10n == "string" ? props.l10n : props.l10n.id;
  }
  return <div {...mockProps}>{props.children}</div>;
}
