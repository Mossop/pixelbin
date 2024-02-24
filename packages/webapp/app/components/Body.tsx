import { createPortal } from "react-dom";

export default function Body({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}
