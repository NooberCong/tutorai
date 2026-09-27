/** The full creature catalog, one module per element. */

import type { Species } from "./kit.ts";
import { ARCANE } from "./species/arcane.ts";
import { EMBER } from "./species/ember.ts";
import { FROST } from "./species/frost.ts";
import { LEAF } from "./species/leaf.ts";
import { MOON } from "./species/moon.ts";
import { SKY } from "./species/sky.ts";
import { STONE } from "./species/stone.ts";
import { TIDE } from "./species/tide.ts";

export const SPECIES: Species[] = [
  ...LEAF, ...EMBER, ...TIDE, ...STONE, ...SKY, ...FROST, ...MOON, ...ARCANE,
];

const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

export function speciesById(id: string): Species | undefined {
  return BY_ID.get(id);
}
