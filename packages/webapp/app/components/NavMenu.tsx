import { useNavigation } from "@remix-run/react";
import { useCallback, useEffect, useState } from "react";

import { IconButton } from "./Icon";
import { CatalogNav } from "./SidebarLayout";
import SlidePanel from "./SlidePanel";
import { State } from "@/modules/types";

export default function NavMenu({ serverState }: { serverState: State }) {
  let [showNavigator, setShowNavigator] = useState(false);
  let openNavigator = useCallback(() => setShowNavigator(true), []);
  let hideNavigator = useCallback(() => setShowNavigator(false), []);

  let navigation = useNavigation();
  useEffect(() => {
    if (navigation.state != "idle") {
      hideNavigator();
    }
  }, [navigation, hideNavigator]);

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
          <CatalogNav serverState={serverState} />
        </div>
      </SlidePanel>
    </div>
  );
}
