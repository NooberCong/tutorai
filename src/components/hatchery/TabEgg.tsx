import { eggReady } from "../../lib/hatchery/game";
import { useHatchery } from "../../lib/hatchery/store";
import { PixelImg, crackOf, eggUrl } from "./sprites";

/** The incubator's egg as a tab icon, with a dot when it's ready to hatch. */
export function TabEgg() {
  const s = useHatchery();
  const egg = s.incubator;
  if (!egg) return null;
  return (
    <span className={`tab-egg ${eggReady(s) ? "ready" : ""}`}>
      <span className="egg-crop">
        <PixelImg src={eggUrl(egg, crackOf(egg))} scale={1} />
      </span>
    </span>
  );
}
