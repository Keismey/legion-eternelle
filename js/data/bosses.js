// Les 8 boss de l'original, dans l'ordre où on les rencontre (niveaux 5, 10, 15…).
// hp/atk : variations autour du profil de boss standard (BALANCE.boss).
// skill : une capacité lisible, déclenchée toutes les `every` secondes.
export const BOSSES = [
  { id: "ancientGolem", icon: "🗿", hp: 1.15, atk: 0.9, skill: { type: "aoe", every: 8, power: 1.1 } },
  { id: "bladeMaster", icon: "⚔️", hp: 0.85, atk: 1.15, skill: { type: "flurry", every: 7, power: 2.2 } },
  { id: "voidArchmage", icon: "🌌", hp: 0.8, atk: 1.1, skill: { type: "aoe", every: 6, power: 1.2 } },
  { id: "fallenHighPriest", icon: "☠️", hp: 1, atk: 0.95, skill: { type: "regen", every: 6, power: 0.03 } },
  { id: "colossalGuardian", icon: "🛡️", hp: 1.3, atk: 0.85, skill: { type: "shield", every: 9, power: 0.08 } },
  { id: "scarletHunter", icon: "🏹", hp: 0.9, atk: 1.1, skill: { type: "execute", every: 6, power: 2.5 } },
  { id: "arcaneDragon", icon: "🐉", hp: 1.1, atk: 1.05, skill: { type: "aoe", every: 7, power: 1.4 } },
  { id: "primalDruid", icon: "🌿", hp: 1.2, atk: 0.9, skill: { type: "regen", every: 5, power: 0.025 } },
];

// Un set par boss, qui ne tombe que dans son repaire.
// Bonus par héros : à 2 pièces, puis à 4 pièces (cumulés).
export const SETS = {
  ancientGolem: { 2: { armorPct: 0.25 }, 4: { thorns: 0.25, block: 0.08 } },
  bladeMaster: { 2: { haste: 0.15 }, 4: { doubleStrike: 0.25 } },
  voidArchmage: { 2: { powerPct: 0.15 }, 4: { cleave: 0.4 } },
  fallenHighPriest: { 2: { lifesteal: 0.08 }, 4: { phoenix: 0.5 } },
  colossalGuardian: { 2: { hpPct: 0.2 }, 4: { guard: 0.15 } },
  scarletHunter: { 2: { crit: 0.1 }, 4: { critDmg: 0.6 } },
  arcaneDragon: { 2: { burn: 0.2 }, 4: { burn: 0.4, chain: 0.15 } },
  primalDruid: { 2: { healPct: 0.2 }, 4: { healSplash: 0.5 } },
};

// Corruption : au-delà du niveau 40 (2e passage des boss), chaque boss gagne
// un mécanisme en plus de sa capacité, et devient plus résistant.
export const CORRUPT_LEVEL = 40;
export const CORRUPT_HP = 1.15;
export const CORRUPTIONS = {
  ancientGolem: { type: "summon", every: 14, count: 2 }, // éclats de pierre
  bladeMaster: { type: "enrage", every: 5, gain: 0.07 }, // +7 % d'attaque toutes les 5 s
  voidArchmage: { type: "drain", amount: 30 }, // vide la jauge d'ultime de sa cible
  fallenHighPriest: { type: "curse", heal: 0.5 }, // soins reçus divisés par 2
  colossalGuardian: { type: "reflect", duration: 3, share: 0.3 }, // renvoie 30 % après sa capacité
  scarletHunter: { type: "bleed", every: 7, dps: 0.025, duration: 4 }, // saignement sur toute l'équipe
  arcaneDragon: { type: "nova", every: 15, power: 3 }, // énorme explosion : à contrer avec le Cri du tank
  primalDruid: { type: "summon", every: 12, count: 2 }, // tréants
};

export const isCorrupted = (level) => level > CORRUPT_LEVEL;

export const MONSTERS = ["goblin", "ghoul", "wolf", "bandit", "spider", "orc", "skeleton", "cultist", "slime", "harpy"];

export function bossForLevel(level, bossEvery) {
  const index = Math.floor(level / bossEvery) - 1;
  return BOSSES[((index % BOSSES.length) + BOSSES.length) % BOSSES.length];
}
