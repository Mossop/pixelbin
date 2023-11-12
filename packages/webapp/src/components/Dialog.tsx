import Modal, { ModalProps } from "./Modal";

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
      <div className="c-dialog">
        <div className="header">{header}</div>
        <div className="body">{children}</div>
        <div className="footer">{footer}</div>
      </div>
    </Modal>
  );
}
