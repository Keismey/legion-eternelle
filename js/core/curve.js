// Formules d'équilibrage. Fonctions pures, sans DOM : utilisables par le jeu,
// les simulations en ligne de commande (tools/).
import { BALANCE as B, RARITIES } from "../data/config.js";

export const K = (level, b = B) => Math.pow(b.growth, Math.max(0, level - 1));
export const KM = (level, b = B) => Math.pow(b.monsterGrowth, Math.max(0, level - 1));

export const isBossLevel = (level, b = B) => level % b.bossEvery === 0;

export function monsterStats(level, groupSize = 1, b = B) {
  const group = b.groupSizes.find((g) => g.count === groupSize) || b.groupSizes[0];
  const km = KM(level, b);
  return {
    hp: Math.round(b.monster.hp * km * group.hp),
    atk: b.monster.atk * km * group.atk,
    defense: b.monster.defense,
  };
}

export function bossStats(level, boss, b = B) {
  const km = KM(level, b);
  return {
    hp: Math.round(b.monster.hp * km * b.boss.hp * boss.hp),
    atk: b.monster.atk * km * b.boss.atk * boss.atk,
    defense: b.boss.defense,
  };
}

export const xpToNext = (heroLevel, b = B) => Math.round(b.xpToLevel * K(heroLevel, b));
export const xpPerMonster = (level, b = B) => b.xpPerMonster * K(level, b);
export const goldPerMonster = (level, b = B) => b.goldPerMonster * K(level, b);
export const itemBudget = (itemLevel, rarityKey, b = B) =>
  b.itemBudget * K(itemLevel, b) * (RARITIES.find((r) => r.key === rarityKey)?.mult || 1);
export const sellValue = (item, b = B) =>
  Math.max(1, Math.round(b.sellValue * K(item.level, b) * (RARITIES.find((r) => r.key === item.rarity)?.mult || 1)));
export const forgeCost = (item, b = B) =>
  Math.round(b.forgeBaseCost * K(item.level, b) * Math.pow(b.forgeCostGrowth, item.plus || 0));

export function damageReduction(armor, attackerLevel, b = B) {
  const r = armor / (armor + b.armorFactor * KM(attackerLevel, b));
  return Math.min(b.maxReduction, r);
}

export function soulsForLevel(maxLevel, b = B) {
  if (maxLevel < b.prestigeMinLevel) return 0;
  return Math.floor(Math.pow(maxLevel / b.soulsBase, b.soulsExponent) * 5);
}
