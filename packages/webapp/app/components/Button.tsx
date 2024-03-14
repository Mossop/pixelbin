import { SlButton, SlButtonProps } from "shoelace-react";

export default function Button({
  label,
  type = "default",
  disabled,
  onClick = () => {},
}: {
  label: string;
  type?: SlButtonProps["variant"];
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <SlButton onClick={onClick} disabled={disabled} variant={type}>
      {label}
    </SlButton>
  );
}
