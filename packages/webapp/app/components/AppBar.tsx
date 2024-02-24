import Avatar from "./Avatar";
import { useServerState } from "@/modules/client-util";

export default function AppBar() {
  let serverState = useServerState();
  let email = serverState?.email;

  return (
    <header className="c-appbar" data-theme="banner">
      <div className="site">
        <h1>PixelBin</h1>
      </div>
      <div>
        <Avatar email={email} />
      </div>
    </header>
  );
}
