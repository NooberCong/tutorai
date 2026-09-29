/** A "?" beside an egg type that explains how to find that element. */

import { useEffect, useRef, useState } from "react";
import type { Element } from "../../lib/hatchery/kit";
import { DAY_MIN, FIND_EVERY_MIN, LONG_SITTING_MIN, SLOW_PAGE_S } from "../../lib/hatchery/game";
import { ELEMENT_LABEL } from "./labels";
import { PixelImg, eggUrl } from "./sprites";

const HOW: Record<Element, string> = {
  sky: "Read in the morning, 5 am to noon.",
  leaf: "Read in the afternoon, noon to 5 pm.",
  tide: "Read in the evening, 5 to 9 pm.",
  moon: "Read late at night, 9 pm to 5 am.",
  ember: `Stay with your reading for ${LONG_SITTING_MIN} minutes or more in one sitting. Breaks under 10 minutes don't end it.`,
  frost: `Read slowly and carefully: ${SLOW_PAGE_S / 60} minutes or more per page on average, over at least 5 pages in one sitting.`,
  stone: `Read at least ${DAY_MIN} minutes on 4 of the last 7 days.`,
  arcane:
    "Use the study tools: highlight, look words up, answer quiz questions right, ask the tutor. Rarer than the others without them.",
};

export function EggHelp(props: { element: Element }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const el = props.element;
  return (
    <span className="egg-help" ref={ref}>
      <button
        className={`egg-help-btn ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`How to find ${ELEMENT_LABEL[el]} eggs`}
        title={`How to find ${ELEMENT_LABEL[el]} eggs`}
      >
        ?
      </button>
      {open && (
        <div className="egg-help-pop" role="dialog">
          <div className="egg-help-head">
            <PixelImg src={eggUrl({ element: el, tier: "rare" })} scale={2} />
            <b>{ELEMENT_LABEL[el]} eggs</b>
          </div>
          <p>{HOW[el]}</p>
          <p className="egg-help-fine">
            Eggs turn up every {FIND_EVERY_MIN} minutes of reading, for each chapter you finish, and
            for finishing a book. Their element is decided when they turn up: doing this makes{" "}
            {ELEMENT_LABEL[el]} about {el === "arcane" ? "10" : "4"}× likelier. Chapter and book eggs
            are more often rare, epic or legendary.
          </p>
        </div>
      )}
    </span>
  );
}
