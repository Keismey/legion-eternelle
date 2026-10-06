// Tous les réglages d'équilibrage sont ici, et seulement ici.
// Règle d'or : une seule courbe de référence (K) dont tout découle.
//   K_joueur(L)  = growth ^ (L - 1)          → objets, or, XP, stats de base
//   K_monstre(L) = monsterGrowth ^ (L - 1)   → PV / attaque des monstres
// L'écart (monsterGrowth / growth) crée un mur naturel et prévisible,
// que la rareté, la forge et l'Éveil (prestige) repoussent.

export const BALANCE = {
  growth: 1.1,
  monsterGrowth: 1.125,

  // Progression de zone
  wavesPerLevel: 10,
  bossEvery: 5, // la 10e vague des niveaux multiples de 5 est un boss
  bossTimer: 60, // secondes
  ultCharge: { action: 6, hit: 4 }, // jauge d'ultime (sur 100) par action et par coup reçu ; gardée entre les vagues
  respawnDelay: 4, // secondes après une défaite

  // Vagues
  groupSizes: [
    { count: 1, weight: 50, hp: 1, atk: 1 },
    { count: 2, weight: 30, hp: 0.7, atk: 0.7 },
    { count: 3, weight: 20, hp: 0.55, atk: 0.55 },
  ],
  monster: { hp: 320, atk: 22, attackInterval: 2, defense: 0.05 },
  boss: { hp: 4.5, atk: 2.1, defense: 0.15 }, // multiplicateurs d'un monstre seul

  // Héros (valeurs à K = 1, multipliées par K_joueur(niveau du héros))
  heroAttackInterval: 1.6,
  critChance: 0.05,
  critMultiplier: 1.75,
  armorFactor: 10, // réduction = ARM / (ARM + armorFactor × K_monstre)
  maxReduction: 0.75,
  tauntChance: 0.7, // probabilité qu'un monstre vise le tank

  // XP : le niveau des héros se cale de lui-même près du niveau de zone
  xpPerMonster: 6,
  xpToLevel: 45,
  heroLevelCap: 3, // un héros ne dépasse pas le niveau de zone max + 3

  // Or
  goldPerMonster: 3,
  bossGoldMultiplier: 12,

  // Butin
  lootChance: 0.4,
  huntLootFactor: 0.6, // butin normal réduit dans les repaires
  huntSetChance: 0.06, // pièce de set sur une vague normale de repaire
  bossLootLevelBonus: 2,
  itemBudget: 10,
  inventorySize: 40,
  sellValue: 4,

  // Forge : +10 % de stats par niveau, jusqu'à +10
  forgeStep: 0.1,
  forgeMax: 10,
  forgeBaseCost: 18,
  forgeCostGrowth: 1.55,

  // Hors-ligne
  offlineCapHours: 8,
  offlineEfficiency: 0.5,

  // Éveil (prestige)
  prestigeMinLevel: 25,
  soulsBase: 25, // âmes = floor((niveauMax / soulsBase) ^ soulsExponent × 5)
  soulsExponent: 2.2,
};

// Élites : un monstre renforcé avec un trait visible, qui lâche un meilleur butin.
export const ELITES = {
  chance: 0.08,
  hp: 2.5,
  atk: 1.3,
  types: {
    enraged: { atk: 1.5 },
    armored: { defense: 0.25 },
    regen: { regen: 0.02 }, // % des PV max par seconde
    vampire: { vamp: 0.3 }, // se soigne de 30 % des dégâts infligés
  },
};

// Recyclage : éclats gagnés par rareté, et coût d'une pièce de set fabriquée.
export const CRAFT = {
  salvage: { common: 1, rare: 3, epic: 8, legendary: 20, set: 12 },
  setCost: 120,
};

// Modificateurs de repaire : plus dur, mais plus de butin.
export const MODIFIERS = {
  horde: { hp: 1.6, loot: 0.5 },
  fury: { atk: 1.4, loot: 0.5 },
  rush: { bossTimer: -15, setChance: 0.5 },
};

// Phase 2 des boss sous 50 % de PV ; combo d'ultimes enchaînés.
export const BOSS_PHASE = { threshold: 0.5, atk: 1.35, skillSpeed: 0.7 };
export const COMBO = { window: 3, bonus: 0.5 };

// weight 0 : ne tombe jamais au hasard (les pièces de set viennent des repaires).
export const RARITIES = [
  { key: "common", mult: 1, weight: 55, affixes: 0 },
  { key: "rare", mult: 1.35, weight: 28, affixes: 1 },
  { key: "epic", mult: 1.8, weight: 12.5, affixes: 2 },
  { key: "legendary", mult: 2.4, weight: 4.5, affixes: 2, unique: true },
  { key: "set", mult: 1.9, weight: 0, affixes: 1 },
];

// Répartition du budget d'un objet par emplacement.
// 1 point de budget = 1 PUI = 1 ARM = 6 PV.
export const SLOTS = {
  helmet: { hp: 0.5, power: 0.3, armor: 0.2 },
  gloves: { hp: 0.3, power: 0.7, armor: 0 },
  chest: { hp: 0.5, power: 0, armor: 0.5 },
  legs: { hp: 0.6, power: 0, armor: 0.4 },
  boots: { hp: 0.4, power: 0.4, armor: 0.2 },
};
export const SLOT_KEYS = Object.keys(SLOTS);
export const HP_PER_POINT = 6;

// Orientation d'un objet : déplace le budget entre attaque et défense.
// C'est ce qui crée les compromis (un objet n'est plus « meilleur » pour tous).
export const FOCUS = {
  balanced: { weight: 40 },
  offense: { weight: 30, shift: 0.35 }, // 35 % du budget défensif passe en Puissance
  defense: { weight: 30, shift: 0.6 }, // 60 % de la Puissance passe en PV / Armure
};

// Effets secondaires tirés sur les objets rares et plus.
export const AFFIXES = {
  crit: { min: 0.02, max: 0.05 },
  haste: { min: 0.03, max: 0.07 },
  fortune: { min: 0.05, max: 0.12 },
  lifesteal: { min: 0.03, max: 0.06 },
  thorns: { min: 0.08, max: 0.15 },
  burn: { min: 0.1, max: 0.2 },
  doubleStrike: { min: 0.05, max: 0.1 },
  cleave: { min: 0.1, max: 0.2 },
  block: { min: 0.04, max: 0.08 },
  healPct: { min: 0.06, max: 0.12 },
};

// Effet unique d'un objet légendaire (une seule fois par héros).
export const UNIQUES = {
  executioner: { executioner: 0.6 }, // +60 % de dégâts sous 30 % de PV
  phoenix: { phoenix: 0.4 }, // revient une fois par combat à 40 % de PV
  retaliate: { retaliate: 0.25 }, // 25 % de chances de riposter quand il est frappé
  aegis: { guard: 0.1 }, // l'équipe subit 10 % de dégâts en moins
  frenzy: { frenzy: 0.04 }, // +4 % de hâte par coup, jusqu'à 10 fois
  chain: { chain: 0.2 }, // 20 % de chances de toucher tous les ennemis à 50 %
  vampiric: { lifesteal: 0.15 }, // vol de vie massif
  titan: { hpPct: 0.3 }, // PV +30 %
  tempest: { haste: 0.2 }, // hâte +20 %
  inferno: { burn: 0.5 }, // brûlure +50 %
  bastion: { block: 0.15 }, // blocage 15 %
  reaper: { crit: 0.05, critDmg: 0.8 }, // critiques dévastateurs
};

// Améliorations permanentes achetées avec les âmes
export const AWAKENING = {
  might: { perLevel: 0.12, cost: 1, costGrowth: 1.35 }, // +PUI
  vitality: { perLevel: 0.12, cost: 1, costGrowth: 1.35 }, // +PV et +ARM
  greed: { perLevel: 0.2, cost: 1, costGrowth: 1.35 }, // +or
  luck: { perLevel: 0.1, cost: 2, costGrowth: 1.6 }, // meilleure rareté
  wisdom: { perLevel: 0.15, cost: 1, costGrowth: 1.35 }, // +XP
  momentum: { perLevel: 0.05, cost: 3, costGrowth: 1.8, max: 10 }, // départ à X % du niveau max
  instinct: { perLevel: 1, cost: 4, costGrowth: 1, max: 1 }, // les ultimes se lancent seuls
};
