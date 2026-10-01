import type { Pet } from "../../lib/hatchery/game";
import type { Stage } from "../../lib/hatchery/kit";
import { grownStage, showStage, speciesById, stageOf } from "../../lib/hatchery/game";
import { mutate } from "../../lib/hatchery/store";
import { STAGE_LABEL } from "./labels";

/** Pick the size a pet is shown at, among the stages it has grown through.
 *  Nothing to pick for a hatchling. */
export function StagePicker(props: { pet: Pet }) {
  const { pet } = props;
  const sp = speciesById(pet.species);
  const grown = grownStage(pet);
  if (!sp || grown === 0) return null;
  const shown = stageOf(pet);
  const stages = ([0, 1, 2] as Stage[]).filter((st) => st <= grown);
  return (
    <div className="stage-picker" role="radiogroup" aria-label="Size">
      {stages.map((st) => (
        <button
          key={st}
          role="radio"
          aria-checked={st === shown}
          className={st === shown ? "on" : ""}
          title={st < grown ? `Keep it a ${sp.stages[st]} — it won't grow while kept small` : `Let it be a ${sp.stages[st]}`}
          onClick={() => mutate((s) => showStage(s, pet.id, st), true)}
        >
          {STAGE_LABEL[st]}
        </button>
      ))}
    </div>
  );
}
