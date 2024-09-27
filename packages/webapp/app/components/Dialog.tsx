import { useEffect, useState } from "react";
import { SlDialog } from "shoelace-react";

import "styles/components/Dialog.scss";

function useDialogDefined() {
  let [defined, setDefined] = useState(false);

  useEffect(() => {
    if (!defined) {
      void customElements.whenDefined("sl-dialog").then(() => setDefined(true));
    }
  }, [defined]);

  return defined;
}

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
  let defined = useDialogDefined();

  if (!defined) {
    return null;
  }

  return (
    <SlDialog
      label={label}
      open={show}
      className="sl-theme-light apply-theme"
      onSlAfterHide={onClosed}
    >
      {children}
      <div className="footer" slot="footer">
        {footer}
      </div>
    </SlDialog>
  );
}
