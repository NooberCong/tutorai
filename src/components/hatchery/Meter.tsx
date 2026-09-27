/** A thin progress bar with a caption, tinted by the nearest `tier-*`. */
export function Meter(props: { value: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, (props.value / props.max) * 100));
  return (
    <div className="meter">
      <i className="meter-track">
        <i style={{ width: `${pct}%` }} />
      </i>
      <span>{props.label}</span>
    </div>
  );
}
