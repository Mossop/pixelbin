import Modal, { ModalProps } from "./Modal";

import "styles/components/Dialog.scss";

export default function Dialog({
  header,
  footer,
  children,
  ...modalProps
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
} & ModalProps) {
  return (
    <Modal {...modalProps}>
      <div className="c-dialog modal">
        <div className="header">{header}</div>
        <div className="body">{children}</div>
        <div className="footer">{footer}</div>
      </div>
    </Modal>
  );
}
