import type { Element, Tier } from "../../lib/hatchery/kit";

export const TIER_LABEL: Record<Tier, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const ELEMENT_LABEL: Record<Element, string> = {
  leaf: "Leaf",
  ember: "Ember",
  tide: "Tide",
  stone: "Stone",
  sky: "Sky",
  frost: "Frost",
  moon: "Moon",
  arcane: "Arcane",
};

export const STAGE_LABEL = ["Hatchling", "Juvenile", "Adult"] as const;

/** Reading time, rounded down: "<1m", "25m", "3h 05m". */
export function minutes(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "<1m";
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
