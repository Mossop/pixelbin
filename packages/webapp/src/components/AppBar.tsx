import { Comfortaa } from "next/font/google";

import Avatar from "./Avatar";
import { state } from "@/modules/api";

const comfortaa = Comfortaa({ subsets: ["latin"] });

export default async function AppBar() {
  let serverState = await state();
  let email = serverState?.email;

  return (
    <header className="navbar text-bg-primary d-flex p-3 justify-content-between">
      <h1 className={`navbar-brand m-0 p-0 ${comfortaa.className}`}>
        PixelBin
      </h1>
      <div>
        <Avatar email={email} />
      </div>
    </header>
  );
}
