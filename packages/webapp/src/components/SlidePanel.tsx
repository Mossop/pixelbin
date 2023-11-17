import clsx from "clsx";

import Modal, { ModalProps } from "./Modal";

export default function SlidePanel({
  children,
  theme = "match",
  className,
  position,
  ...modalProps
}: {
  position: "left" | "right";
  theme?: "light" | "dark" | "match";
  className?: string;
  children: React.ReactNode;
} & ModalProps) {
  return (
    <Modal {...modalProps}>
      <div
        className={clsx("c-slidepanel", `slidepanel-${position}`, className)}
      >
        <div className="slidepanel-inner" data-theme={theme}>
          {children}
        </div>
      </div>
    </Modal>
  );
}
