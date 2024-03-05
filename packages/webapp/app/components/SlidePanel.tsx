import clsx from "clsx";

import { IconButton } from "./Icon";
import Modal, { ModalProps } from "./Modal";

export default function SlidePanel({
  children,
  theme = "match",
  className,
  position,
  onClose,
  ...modalProps
}: {
  position: "left" | "right";
  theme?: "light" | "dark" | "match";
  className?: string;
  children: React.ReactNode;
} & ModalProps) {
  return (
    <Modal onClose={onClose} {...modalProps}>
      <div
        className={clsx("c-slidepanel", `slidepanel-${position}`, className)}
      >
        <div className="slidepanel-inner" data-theme={theme}>
          <div className="buttons">
            <IconButton icon="close" onClick={onClose} />
          </div>
          {children}
        </div>
      </div>
    </Modal>
  );
}
