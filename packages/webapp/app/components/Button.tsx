export default function Button({
  label,
  type = "secondary",
  disabled,
  onClick = () => {},
}: {
  label: string;
  type?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`c-button button-${type}`}
      type="button"
    >
      {label}
    </button>
  );
}
