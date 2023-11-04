export default function Icon({
  icon,
  onClick,
}: {
  icon: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button onClick={onClick}>
        <i className={`bi-${icon}`}></i>
      </button>
    );
  }

  return <i className={`bi-${icon}`}></i>;
}
