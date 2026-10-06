// Rôles : stats de base à K = 1 et comportement en combat.
// PV en valeur brute, PUI et ARM en points.
export const ROLES = {
  tank: { icon: "🛡️", base: { hp: 70, power: 5, armor: 6 }, action: "strike", factor: 0.8 },
  dps: { icon: "🗡️", base: { hp: 40, power: 10, armor: 2 }, action: "strike", factor: 1 },
  mage: { icon: "🔮", base: { hp: 34, power: 9, armor: 1.5 }, action: "blast", factor: 0.55 },
  heal: { icon: "💚", base: { hp: 38, power: 8, armor: 2 }, action: "heal", factor: 1.4 },
};
export const ROLE_KEYS = Object.keys(ROLES);

// Une classe = un rôle + un passif, exprimé avec les mêmes effets que les objets
// (voir data/effects.js).
// unlock : null (dès le départ), { boss: id } (1re victoire contre ce boss)
// ou { awakenings: n } (après n Éveils).
export const CLASSES = {
  guardian: { role: "tank", icon: "🛡️", unlock: null, passive: { armorPct: 0.3, hpPct: 0.1, block: 0.06 } },
  paladin: { role: "tank", icon: "✝️", unlock: { boss: "ancientGolem" }, passive: { leech: 0.6 } },
  berserker: { role: "tank", icon: "🪓", unlock: { boss: "colossalGuardian" }, passive: { rage: 1 } },
  runeknight: { role: "tank", icon: "🔷", unlock: { awakenings: 1 }, passive: { thorns: 0.3 } },

  warrior: { role: "dps", icon: "⚔️", unlock: null, passive: { powerPct: 0.2 } },
  ranger: { role: "dps", icon: "🏹", unlock: { boss: "bladeMaster" }, passive: { crit: 0.12 } },
  rogue: { role: "dps", icon: "🗡️", unlock: { boss: "scarletHunter" }, passive: { crit: 0.08, critDmg: 0.7, fortune: 0.1 } },
  monk: { role: "dps", icon: "🥋", unlock: { awakenings: 1 }, passive: { haste: 0.25 } },

  mage: { role: "mage", icon: "🔮", unlock: null, passive: { aoeFactor: 0.72 } },
  warlock: { role: "mage", icon: "👿", unlock: { boss: "arcaneDragon" }, passive: { burn: 0.45 } },
  druid: { role: "mage", icon: "🌿", unlock: { boss: "voidArchmage" }, passive: { powerPct: 0.1, leech: 0.25 } },
  shadowpriest: { role: "mage", icon: "☠️", unlock: { awakenings: 1 }, passive: { singleFactor: 1.1 } },

  cleric: { role: "heal", icon: "💚", unlock: null, passive: { healPct: 0.25, guard: 0.06 } },
  bard: { role: "heal", icon: "🎵", unlock: { boss: "fallenHighPriest" }, passive: { teamHaste: 0.05 } },
  shaman: { role: "heal", icon: "⚡", unlock: { boss: "primalDruid" }, passive: { healAll: 0.45, crit: 0.06 } },
  alchemist: { role: "heal", icon: "⚗️", unlock: { awakenings: 1 }, passive: { fortune: 0.2, loot: 0.1 } },
};
export const CLASS_KEYS = Object.keys(CLASSES);
export const STARTER_CLASSES = { tank: "guardian", dps: "warrior", mage: "mage", heal: "cleric" };
