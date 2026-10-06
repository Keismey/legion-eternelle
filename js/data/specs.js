// Spécialisations (niveau 30) : deux voies par classe, qui s'ajoutent au passif.
// Les noms viennent de l'original (i18n : spec.<classe>.<0|1>).
export const SPEC_LEVEL = 30;

export const SPECS = {
  guardian: [{ armorPct: 0.25, block: 0.08 }, { guard: 0.1, hpPct: 0.15 }],
  paladin: [{ powerPct: 0.2, leech: 0.2 }, { lifesteal: 0.06, retaliate: 0.15 }],
  berserker: [{ hpPct: 0.3 }, { powerPct: 0.15, cleave: 0.25 }],
  runeknight: [{ thorns: 0.2, block: 0.06 }, { burn: 0.3 }],
  warrior: [{ cleave: 0.3 }, { doubleStrike: 0.15, crit: 0.05 }],
  ranger: [{ critDmg: 0.5 }, { executioner: 0.4, haste: 0.1 }],
  rogue: [{ executioner: 0.6 }, { burn: 0.25, fortune: 0.1 }],
  monk: [{ doubleStrike: 0.2 }, { lifesteal: 0.06, leech: 0.15 }],
  mage: [{ powerPct: 0.2 }, { burn: 0.25, chain: 0.1 }],
  warlock: [{ doubleStrike: 0.1, burn: 0.15 }, { lifesteal: 0.08, leech: 0.1 }],
  druid: [{ haste: 0.15, leech: 0.1 }, { burn: 0.3 }],
  shadowpriest: [{ executioner: 0.5 }, { critDmg: 0.5, crit: 0.05 }],
  cleric: [{ healPct: 0.25 }, { guard: 0.08, healSplash: 0.3 }],
  bard: [{ teamHaste: 0.04 }, { healSplash: 0.4 }],
  shaman: [{ healPct: 0.2 }, { guard: 0.08 }],
  alchemist: [{ healPct: 0.2, healSplash: 0.2 }, { fortune: 0.25, loot: 0.1 }],
};

// Affixe de classe : présent sur certains objets épiques et plus,
// actif seulement si la classe du héros correspond.
export const CLASS_AFFIXES = {
  guardian: { armorPct: 0.2 },
  paladin: { leech: 0.25 },
  berserker: { cleave: 0.25 },
  runeknight: { thorns: 0.25 },
  warrior: { powerPct: 0.15 },
  ranger: { crit: 0.08 },
  rogue: { critDmg: 0.4 },
  monk: { doubleStrike: 0.12 },
  mage: { chain: 0.15 },
  warlock: { burn: 0.25 },
  druid: { leech: 0.15 },
  shadowpriest: { executioner: 0.4 },
  cleric: { healPct: 0.2 },
  bard: { teamHaste: 0.05 },
  shaman: { healSplash: 0.3 },
  alchemist: { fortune: 0.2 },
};
export const CLASS_AFFIX_CHANCE = 0.3; // sur un objet épique, légendaire ou de set
