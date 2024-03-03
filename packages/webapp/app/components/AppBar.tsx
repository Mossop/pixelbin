import { UIMatch, useMatches } from "@remix-run/react";

import Avatar from "./Avatar";
import NavMenu from "./NavMenu";
import { useServerState } from "@/modules/client-util";

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
    <header className="c-appbar" data-theme="banner">
      <div className="site">
        {serverState && <NavMenu serverState={serverState} />}
        <h1>PixelBin</h1>
      </div>
      <div className="actions">
        <div className="buttons">
          {matches.filter(hasButtons).map((p) => (
            <HeaderButton key={p.id} provider={p} />
          ))}
        </div>
        <Avatar email={email} />
      </div>
    </header>
  );
}
