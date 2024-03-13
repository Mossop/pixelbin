import "styles/components/Throbber.scss";

export default function Throbber() {
  return (
    <div className="c-throbber">
      <div className="throbber">
        <div className="start" />
        <div className="middle" />
        <div className="end" />
      </div>
    </div>
  );
}
