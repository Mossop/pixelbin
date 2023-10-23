import { Comfortaa } from "next/font/google";

import { session } from "@/modules/session";
import Avatar from "./Avatar";

const comfortaa = Comfortaa({ subsets: ["latin"] });

export default function AppBar() {
  let email = session();

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
