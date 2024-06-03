import { UIMatch, useMatches } from "@remix-run/react";

import Avatar from "./Avatar";
import NavMenu from "./NavMenu";
import { CastButton } from "@/components/CastManager";
import { useServerState } from "@/modules/hooks";

import "styles/components/AppBar.scss";

type ButtonProvider = UIMatch<
  any,
  { headerButtons(data: any): React.ReactNode }
>;

function hasButtons(match: UIMatch): match is ButtonProvider {
  if (!match.handle) {
    return false;
  }

  return typeof match.handle == "object" && "headerButtons" in match.handle;
}

function HeaderButton({ provider }: { provider: ButtonProvider }) {
  return provider.handle.headerButtons(provider.data);
}

export default function AppBar() {
  let serverState = useServerState();
  let email = serverState?.email;

  let matches = useMatches();

  return (
    <header className="c-appbar sl-theme-dark apply-theme">
      <div className="site">
        {serverState && <NavMenu serverState={serverState} />}
        <img src="/logo.svg" alt="" />
        <h1>PixelBin</h1>
      </div>
      <div className="actions">
        <div className="buttons">
          {matches.filter(hasButtons).map((p) => (
            <HeaderButton key={p.id} provider={p} />
          ))}
        </div>
        <CastButton />
        <Avatar email={email} />
      </div>
    </header>
  );
}
