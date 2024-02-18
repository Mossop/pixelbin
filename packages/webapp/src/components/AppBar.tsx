"use client";

import { Comfortaa } from "next/font/google";
import { useCallback, useState } from "react";

import Avatar from "./Avatar";
import { useAppState } from "./Config";
import { IconButton } from "./Icon";
import { CatalogNav } from "./SidebarLayout";
import SlidePanel from "./SlidePanel";

const comfortaa = Comfortaa({ subsets: ["latin"] });

export default function AppBar() {
  let serverState = useAppState();
  let email = serverState?.email;

  let [showNavigator, setShowNavigator] = useState(false);
  let openNavigator = useCallback(() => setShowNavigator(true), []);
  let hideNavigator = useCallback(() => setShowNavigator(false), []);

  return (
    <header className="c-appbar" data-theme="banner">
      {serverState && <IconButton icon="menu" onClick={openNavigator} />}
      <h1 className={comfortaa.className}>PixelBin</h1>
      <div>
        <Avatar email={email} />
      </div>
      {serverState && (
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
      )}
    </header>
  );
}
