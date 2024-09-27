import { SlButton, SlButtonProps } from "shoelace-react";

export default function Button({
  label,
  type = "default",
  disabled,
  className,
  onClick,
}: {
  label: string;
  type?: SlButtonProps["variant"];
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <SlButton
      className={className}
      onClick={onClick}
      disabled={disabled}
      variant={type}
    >
      {label}
    </SlButton>
  );
}
