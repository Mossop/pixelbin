import "styles/components/TextField.scss";

export default function TextField({
  label,
  autofocus,
  autocomplete = "text",
  type = "text",
  name = "",
  onChange,
  value,
}: {
  id?: string;
  label: string;
  name?: string;
  onChange: (str: string) => void;
  value: string;
  autofocus?: boolean;
  autocomplete?: string;
  type?: string;
}) {
  return (
    <label className="c-textfield">
      <div>{label}</div>
      <input
        autoFocus={autofocus}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autocomplete}
        className="form-control"
      />
    </label>
  );
}
