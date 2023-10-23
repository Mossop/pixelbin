"use client";

export default function TextField({
  id,
  label,
  autofocus,
  autocomplete = "text",
  type = "text",
  name = "",
  onChange,
  value,
}: {
  id: string;
  label: string;
  name?: string;
  onChange: (str: string) => void;
  value: string;
  autofocus?: boolean;
  autocomplete?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input
        autoFocus={autofocus}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autocomplete}
        className="form-control"
        id={id}
      />
    </div>
  );
}
