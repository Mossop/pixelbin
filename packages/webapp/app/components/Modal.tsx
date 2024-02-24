import { useCallback, useRef } from "react";

import Body from "./Body";
import { useTransition } from "@/modules/client-util";

export interface ModalProps {
  show: boolean;
  onClose: () => void;
  onClosed?: () => void;
  children: React.ReactNode;
}

export default function Modal({
  show,
  children,
  onClose,
  onClosed,
}: ModalProps) {
  let modalRef = useRef<HTMLDivElement>();

  let onShown = useCallback(() => {
    modalRef.current
      ?.querySelector<HTMLInputElement>("input[autofocus]")
      ?.focus();
  }, []);

  let [elementRef, renderModel] = useTransition(show, {
    onShown,
    onHidden: onClosed,
  });

  let modalRefCallback = useCallback(
    (element: HTMLDivElement) => {
      modalRef.current = element;
      elementRef(element);
    },
    [elementRef]
  );

  let click = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target != event.currentTarget || !show) {
        return;
      }

      onClose();
    },
    [show, onClose]
  );

  return (
    renderModel && (
      <Body>
        <div ref={modalRefCallback} className="c-modal" onClick={click}>
          {children}
        </div>
      </Body>
    )
  );
}
