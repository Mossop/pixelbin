import { Comfortaa } from "next/font/google";

import Avatar from "./Avatar";
import { state } from "@/modules/api";

const comfortaa = Comfortaa({ subsets: ["latin"] });

export default async function AppBar() {
  let serverState = await state();
  let email = serverState?.email;

  return (
    <header className="c-appbar" data-theme="banner">
      <h1 className={comfortaa.className}>PixelBin</h1>
      <div>
        <Avatar email={email} />
      </div>
    </header>
  );
}
