export default function Throbber() {
  return (
    <div
      style={{ height: "100%", width: "100%" }}
      className="d-flex align-items-center justify-content-center"
    >
      <div className="d-flex throbber">
        <div className="start" />
        <div className="middle" />
        <div className="end" />
      </div>
    </div>
  );
}
