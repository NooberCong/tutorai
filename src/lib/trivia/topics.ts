/** The curated topics a player picks for Daily Trivia. Each carries an
 *  "angle" — what makes the subject fun for a layperson, handed to the
 *  writer — and the hatchery element its eggs lean toward, so a Space fan's
 *  streak eggs come out moon and an Animals fan's come out leaf. */

import type { Element } from "../hatchery/kit";

export interface Topic {
  id: string;
  label: string;
  angle: string;
  element: Element;
}

export const TOPICS: Topic[] = [
  { id: "animals", label: "Animals", element: "leaf", angle: "strange behaviours, record-breakers, newly described species" },
  { id: "plants", label: "Plants & Fungi", element: "leaf", angle: "plant cleverness, fungal networks, the oldest and largest living things" },
  { id: "oceans", label: "Oceans", element: "tide", angle: "the deep sea, ocean discoveries, shipwrecks and sea life" },
  { id: "space", label: "Space", element: "moon", angle: "missions, what's in the sky this month, the strangeness of other worlds" },
  { id: "mind", label: "Mind & Body", element: "moon", angle: "how the brain and body really work, sleep, senses, everyday psychology" },
  { id: "weather", label: "Weather & Climate", element: "sky", angle: "extreme weather, the atmosphere, how the climate shapes daily life" },
  { id: "places", label: "Places & Travel", element: "sky", angle: "odd borders, remarkable towns, landmarks and the stories behind them" },
  { id: "arts", label: "Art, Music & Film", element: "sky", angle: "the stories behind famous works, artists, records and releases" },
  { id: "polar", label: "Extreme Places", element: "frost", angle: "poles, peaks, deserts and caves — life and exploration at the edges" },
  { id: "history", label: "History", element: "stone", angle: "anniversaries this week, overlooked people, how everyday things began" },
  { id: "archaeology", label: "Archaeology", element: "stone", angle: "new digs, decoded texts, how ancient people actually lived" },
  { id: "science", label: "Science", element: "arcane", angle: "surprising experiments and discoveries, and the people behind them" },
  { id: "tech", label: "Technology & AI", element: "arcane", angle: "how the gadgets and systems we use work, and where they came from" },
  { id: "words", label: "Words & Books", element: "arcane", angle: "word origins, languages, famous books and their authors" },
  { id: "food", label: "Food & Drink", element: "ember", angle: "where foods come from, kitchen chemistry, food traditions" },
  { id: "inventions", label: "Inventions", element: "ember", angle: "engineering feats, accidental inventions, how things are made" },
  { id: "sports", label: "Sports & Games", element: "ember", angle: "records, rules with odd origins, great moments and games of skill" },
];

export const TOPIC: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** Picking at least this many keeps a day's ten questions varied. */
export const MIN_TOPICS = 3;
