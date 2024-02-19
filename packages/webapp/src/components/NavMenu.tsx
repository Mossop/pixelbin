"use client";

import { useCallback, useState } from "react";

import { IconButton } from "./Icon";
import { CatalogNav } from "./SidebarLayout";
import SlidePanel from "./SlidePanel";
import { State } from "@/modules/types";

export default function NavMenu({ serverState }: { serverState: State }) {
  let [showNavigator, setShowNavigator] = useState(false);
  let openNavigator = useCallback(() => setShowNavigator(true), []);
  let hideNavigator = useCallback(() => setShowNavigator(false), []);

  if (!serverState) {
    return <div className="c-navmenu" />;
  }

  return (
    <div className="c-navmenu">
      <IconButton icon="menu" onClick={openNavigator} />
      <SlidePanel
        show={showNavigator}
        position="left"
        onClose={hideNavigator}
        className="c-navigator"
      >
        <div className="viewport">
          <div className="buttons">
            <IconButton icon="close" onClick={hideNavigator} />
          </div>
          <CatalogNav serverState={serverState} />
        </div>
      </SlidePanel>
    </div>
  );
}
