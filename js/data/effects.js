// Catalogue des effets. Classes, objets, légendaires et sets utilisent
// tous ces mêmes clés : le moteur de combat n'a qu'un seul vocabulaire.
// Les valeurs s'additionnent (sauf indication contraire dans combat.js).
//
// kind : "pct" s'affiche « +12 % », "flag" s'affiche sans valeur.
export const EFFECTS = {
  powerPct: { kind: "pct" },
  hpPct: { kind: "pct" },
  armorPct: { kind: "pct" },
  crit: { kind: "pct" },
  critDmg: { kind: "pct" },
  haste: { kind: "pct" },
  teamHaste: { kind: "pct" },
  fortune: { kind: "pct" },
  loot: { kind: "pct" },
  lifesteal: { kind: "pct" },
  leech: { kind: "pct" },
  thorns: { kind: "pct" },
  burn: { kind: "pct" },
  doubleStrike: { kind: "pct" },
  cleave: { kind: "pct" },
  block: { kind: "pct" },
  healPct: { kind: "pct" },
  healSplash: { kind: "pct" },
  healAll: { kind: "pct" },
  guard: { kind: "pct" },
  rage: { kind: "flag" },
  aoeFactor: { kind: "flag" },
  singleFactor: { kind: "flag" },
  executioner: { kind: "pct" },
  phoenix: { kind: "pct" },
  retaliate: { kind: "pct" },
  frenzy: { kind: "pct" },
  chain: { kind: "pct" },
};

// Effets « non additifs » : on garde la valeur la plus forte.
export const MAX_EFFECTS = new Set(["aoeFactor", "singleFactor", "phoenix", "rage"]);

export function addEffects(target, source, scale = 1) {
  for (const [key, value] of Object.entries(source || {})) {
    if (MAX_EFFECTS.has(key)) target[key] = Math.max(target[key] || 0, value);
    else target[key] = (target[key] || 0) + value * scale;
  }
  return target;
}
