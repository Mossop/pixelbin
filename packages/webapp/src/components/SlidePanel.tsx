import clsx from "clsx";

import Modal, { ModalProps } from "./Modal";

export default function SlidePanel({
  children,
  className,
  position,
  ...modalProps
}: {
  position: "left" | "right";
  className?: string;
  children: React.ReactNode;
} & ModalProps) {
  return (
    <Modal {...modalProps}>
      <div
        className={clsx("c-slidepanel", `slidepanel-${position}`, className)}
      >
        <div className="slidepanel-inner">{children}</div>
      </div>
    </Modal>
  );
}
