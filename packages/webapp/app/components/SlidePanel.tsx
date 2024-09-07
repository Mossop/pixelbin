import { useCallback, useState } from "react";
import { SlDrawer } from "shoelace-react";

export default function SlidePanel({
  children,
  show,
  label,
  theme,
  position,
  onClosed,
}: {
  position: "left" | "right";
  label: string;
  show: boolean;
  theme?: "light" | "dark";
  onClosed?: () => void;
  children: React.ReactNode;
}) {
  let [showChildren, setShowChildren] = useState(show);

  let onShow = useCallback(() => setShowChildren(true), []);
  let onAfterHide = useCallback(() => {
    setShowChildren(false);
    if (onClosed) {
      onClosed();
    }
  }, [onClosed]);

  return (
    <SlDrawer
      label={label}
      open={show}
      placement={position == "left" ? "start" : "end"}
      onSlShow={onShow}
      onSlAfterHide={onAfterHide}
      className={theme ? `sl-theme-${theme} apply-theme` : undefined}
    >
      {(show || showChildren) && children}
    </SlDrawer>
  );
}
