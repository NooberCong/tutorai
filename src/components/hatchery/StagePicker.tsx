import type { Pet } from "../../lib/hatchery/game";
import type { Stage } from "../../lib/hatchery/kit";
import { canShine, grownStage, setShiny, showStage, speciesById, stageOf } from "../../lib/hatchery/game";
import { mutate } from "../../lib/hatchery/store";
import { STAGE_LABEL } from "./labels";
import { PixelImg, speciesUrl } from "./sprites";

/** How a pet is shown: its size, among the stages it has grown through,
 *  and its colours, once a shiny of its species has hatched — each choice
 *  a small sprite. Nothing to pick for a plain hatchling. */
export function StagePicker(props: { pet: Pet }) {
  const { pet } = props;
  const sp = speciesById(pet.species);
  const grown = grownStage(pet);
  const shine = canShine(pet);
  if (!sp || (grown === 0 && !shine)) return null;
  const shown = stageOf(pet);
  const stages = ([0, 1, 2] as Stage[]).filter((st) => st <= grown);
  return (
    <div className="stage-picker">
      {grown > 0 && (
        <div role="radiogroup" aria-label="Size">
          {stages.map((st) => (
            <button
              key={st}
              role="radio"
              aria-checked={st === shown}
              aria-label={STAGE_LABEL[st]}
              className={st === shown ? "on" : ""}
              title={
                st < grown
                  ? `${STAGE_LABEL[st]} — keep it small (it won't grow meanwhile)`
                  : `${STAGE_LABEL[st]} — its full size`
              }
              onClick={() => mutate((s) => showStage(s, pet.id, st), true)}
            >
              <PixelImg src={speciesUrl(pet.species, st, "idle", pet.shiny)} scale={1} />
            </button>
          ))}
        </div>
      )}
      {shine && (
        <div>
          <button
            role="switch"
            aria-checked={pet.shiny}
            aria-label="Shiny colours"
            className={pet.shiny ? "on shiny" : "shiny"}
            title={pet.shiny ? "Shiny — click for its usual colours" : "Show it in its shiny colours"}
            onClick={() => mutate((s) => setShiny(s, pet.id, !pet.shiny), true)}
          >
            <PixelImg src={speciesUrl(pet.species, shown, "idle", true)} scale={1} />
            <i>✦</i>
          </button>
        </div>
      )}
    </div>
  );
}
