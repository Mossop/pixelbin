import { SlInput, SlInputProps } from "shoelace-react";

export default function TextField({
  label,
  autofocus,
  autocomplete = "text",
  type = "text",
  name = "",
  onChange,
  value,
}: {
  label: string;
  name?: string;
  onChange: (str: string) => void;
  value: string;
  autofocus?: boolean;
  autocomplete?: string;
  type?: SlInputProps["type"];
}) {
  return (
    <SlInput
      label={label}
      type={type}
      autofocus={autofocus}
      autocomplete={autocomplete}
      name={name}
      value={value}
      onSlInput={(event) => onChange(event.target.value)}
    />
  );
}
