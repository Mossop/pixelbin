import Avatar from "./Avatar";
import NavMenu from "./NavMenu";
import { generatePortalId, Portal, portaled } from "./Portal";
import { CastButton } from "@/components/CastManager";
import { useServerState } from "@/modules/hooks";
import "styles/components/AppBar.scss";

const headerButtonsPortal = generatePortalId();
export const HeaderButtons = portaled(headerButtonsPortal);

export default function AppBar() {
  let serverState = useServerState();
  let email = serverState?.email;

  return (
    <header className="c-appbar sl-theme-dark apply-theme">
      <div className="site">
        {serverState && <NavMenu serverState={serverState} />}
        <img src="/logo.svg" alt="" />
        <h1>PixelBin</h1>
      </div>
      <div className="actions">
        <Portal id={headerButtonsPortal} className="buttons" />
        <CastButton />
        <Avatar email={email} />
      </div>
    </header>
  );
}
