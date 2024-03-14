import { SlDialog } from "shoelace-react";

import "styles/components/Dialog.scss";

export default function Dialog({
  label,
  footer,
  show,
  onClosed,
  children,
}: {
  label: string;
  footer?: React.ReactNode;
  show: boolean;
  onClosed?: () => void;
  children: React.ReactNode;
}) {
  return (
    <SlDialog
      label={label}
      open={show}
      className="sl-theme-light"
      onSlAfterHide={onClosed}
    >
      {children}
      <div className="footer" slot="footer">
        {footer}
      </div>
    </SlDialog>
  );
}
