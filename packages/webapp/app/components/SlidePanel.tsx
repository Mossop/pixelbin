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
  return (
    <SlDrawer
      label={label}
      open={show}
      placement={position == "left" ? "start" : "end"}
      onSlAfterHide={onClosed}
      className={theme ? `sl-theme-${theme}` : undefined}
    >
      {children}
    </SlDrawer>
  );
}
