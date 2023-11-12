import clsx from "clsx";
import { useCallback, useRef, useState } from "react";

import Body from "./Body";

enum State {
  Hidden,
  Rendered,
  Shown,
}

export interface ModalProps {
  hidden?: boolean;
  onClose: () => void;
  onClosed?: () => void;
  children: React.ReactNode;
}

export default function Modal({
  hidden,
  children,
  onClose,
  onClosed,
}: ModalProps) {
  let [state, setState] = useState(State.Hidden);
  let modalRef = useRef<HTMLDivElement>(null);

  let transitionEnd = useCallback(() => {
    if (hidden) {
      if (onClosed) {
        onClosed();
      }
      setState(State.Hidden);
    }
  }, [hidden, onClosed]);

  let click = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target != event.currentTarget || state !== State.Shown) {
        return;
      }

      onClose();
    },
    [state, onClose],
  );

  if (state === State.Hidden && !hidden) {
    setState(State.Rendered);
  }

  if (state === State.Rendered && !hidden) {
    setTimeout(() => {
      setState(State.Shown);
      modalRef.current
        ?.querySelector<HTMLInputElement>("input[autofocus]")
        ?.focus();
    }, 100);
  }

  if (state === State.Shown && hidden) {
    setState(State.Rendered);
  }

  return (
    state !== State.Hidden && (
      <Body>
        <div
          className={clsx("c-modal", state === State.Shown && "show")}
          onTransitionEnd={transitionEnd}
          onClick={click}
        >
          <div
            className={clsx("modal", state === State.Shown && "show")}
            ref={modalRef}
          >
            {children}
          </div>
        </div>
      </Body>
    )
  );
}
