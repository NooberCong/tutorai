import type { Pet } from "../../lib/hatchery/game";
import { grownStage, growNeedMs, speciesById } from "../../lib/hatchery/game";
import { STAGE_LABEL } from "./labels";

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

/** How far a pet has grown: a three-step track (hatchling, juvenile,
 *  adult), each step filling as it grows into it. */
export function GrowthMeter(props: { pet: Pet }) {
  const sp = speciesById(props.pet.species);
  if (!sp) return null;
  const [j, a] = growNeedMs(sp);
  const xp = props.pet.xp;
  const fill = [1, xp / j, (xp - j) / (a - j)].map((f) => Math.max(0, Math.min(1, f)) * 100);
  return (
    <span className="growth" title={`Grown to ${STAGE_LABEL[grownStage(props.pet)].toLowerCase()}`}>
      {fill.map((f, i) => (
        <i key={i}>
          <i style={{ width: `${f}%` }} />
        </i>
      ))}
    </span>
  );
}
