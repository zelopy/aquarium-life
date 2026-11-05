import { BALANCE } from "../../game/balance";
import { guppy } from "./guppy";
import type { Rarity, SpeciesConfig, VariantConfig } from "./types";

export const SPECIES: Record<string, SpeciesConfig> = {
  [guppy.id]: guppy,
};

/**
 * 등급별 확률(BALANCE.variantRarityWeights)에 따라 변이를 하나 뽑는다.
 * 같은 등급 안에서는 균등하게 고른다.
 */
export function rollVariant(species: SpeciesConfig, random: () => number = Math.random): VariantConfig {
  const byRarity = new Map<Rarity, VariantConfig[]>();
  for (const v of species.variants) {
    const list = byRarity.get(v.rarity) ?? [];
    list.push(v);
    byRarity.set(v.rarity, list);
  }

  const tiers = [...byRarity.keys()];
  const total = tiers.reduce((sum, r) => sum + BALANCE.variantRarityWeights[r], 0);
  let roll = random() * total;
  for (const rarity of tiers) {
    roll -= BALANCE.variantRarityWeights[rarity];
    if (roll < 0) {
      const list = byRarity.get(rarity)!;
      return list[Math.floor(random() * list.length)];
    }
  }
  return species.variants[0];
}

export type { SpeciesConfig, VariantConfig } from "./types";
