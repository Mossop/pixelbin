import React, { PropsWithChildren, ReactNode } from "react";

export default function Banner(props: PropsWithChildren<void>): ReactNode {
  return <div className="mock-banner">{props.children}</div>;
}
