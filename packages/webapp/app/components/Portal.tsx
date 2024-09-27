import clsx from "clsx";
import { createContext, useCallback, useContext, useMemo } from "react";
import { createPortal } from "react-dom";

import { BaseContext, useContextProperty } from "@/modules/hooks";
import { Replace } from "@/modules/types";

type PortalId = object;

type PortalProps = Replace<
  React.HTMLAttributes<HTMLDivElement>,
  { id: PortalId }
>;

export function generatePortalId(): PortalId {
  return {};
}

class Portals extends BaseContext {
  private portals: Map<PortalId, Element> = new Map();

  public setPortal(id: PortalId, element: Element | null) {
    if (element) {
      if (this.portals.get(id) !== element) {
        this.portals.set(id, element);
        this.changed();
      }
    } else if (this.portals.has(id)) {
      this.portals.delete(id);
      this.changed();
    }
  }

  public getPortal(id: PortalId): Element | null {
    return this.portals.get(id) ?? null;
  }
}

const Context = createContext(new Portals());

export function PortalContext({ children }: { children: React.ReactNode }) {
  let context = useMemo(() => new Portals(), []);

  return <Context.Provider value={context}>{children}</Context.Provider>;
}

export function usePortalRef(id: PortalId): (element: Element | null) => void {
  let context = useContext(Context);

  return useCallback(
    (element: Element | null) => {
      context.setPortal(id, element);
    },
    [id, context],
  );
}

export function usePortal(id: PortalId): Element | null {
  let context = useContext(Context);

  return useContextProperty(context, (portals) => portals.getPortal(id));
}

export function Portal({ id, className, ...props }: PortalProps) {
  let portalRef = usePortalRef(id);

  return (
    <div ref={portalRef} className={clsx(className, "c-portal")} {...props} />
  );
}

export function PortalContent({
  id,
  children,
}: {
  id: PortalId;
  children: React.ReactNode;
}) {
  let portal = usePortal(id);

  if (portal) {
    return createPortal(children, portal);
  }
}

export function portaled(
  id: PortalId,
): (props: { children: React.ReactNode }) => React.ReactNode {
  return function InPortal({ children }: { children: React.ReactNode }) {
    return <PortalContent id={id}>{children}</PortalContent>;
  };
}
