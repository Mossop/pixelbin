import { useCallback, useState, useRef } from "react";
import Body from "./Body";

enum State {
  Hidden,
  Rendered,
  Shown,
}

export default function Dialog({
  hidden,
  header,
  footer,
  children,
  onClose,
  onClosed,
}: {
  hidden?: boolean;
  onClose: () => void;
  onClosed?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  let [state, setState] = useState(State.Hidden);
  let bodyRef = useRef<HTMLDivElement>(null);

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
      bodyRef.current
        ?.querySelector<HTMLInputElement>("input[autofocus]")
        ?.focus();
    }, 100);
  }

  if (state === State.Shown && hidden) {
    setState(State.Rendered);
  }

  let classes = "";
  if (state === State.Shown) {
    classes = "show";
  }

  return (
    state !== State.Hidden && (
      <Body>
        <div
          className={`modal-backdrop fade active ${classes}`}
          onTransitionEnd={transitionEnd}
        ></div>
        <div
          className={`modal fade active ${classes}`}
          style={{ display: "block" }}
          onClick={click}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header border-0 py-1 fs-3">{header}</div>
              <div className="modal-body" ref={bodyRef}>
                {children}
              </div>
              <div className="modal-footer border-0">{footer}</div>
            </div>
          </div>
        </div>
      </Body>
    )
  );
}
