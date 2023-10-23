"use client";

export default function Button({
  label,
  color = "primary",
  disabled,
  onClick = () => {},
}: {
  label: string;
  color?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${color}`}
    >
      {label}
    </button>
  );
}
