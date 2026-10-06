// Calcul des stats et effets d'un héros : niveau, classe, équipement,
// sets et améliorations d'Éveil.
import { BALANCE as B, HP_PER_POINT, SLOT_KEYS, AWAKENING, UNIQUES } from "../data/config.js";
import { ROLES, CLASSES } from "../data/classes.js";
import { SETS } from "../data/bosses.js";
import { addEffects } from "../data/effects.js";
import { SPECS } from "../data/specs.js";
import { codexBonus, starBonus } from "./meta.js";
import { K, damageReduction } from "./curve.js";

export function itemStat(item, stat, b = B) {
  if (!item) return 0;
  return (item[stat] || 0) * (1 + b.forgeStep * (item.plus || 0));
}

export function awakeningBonus(state, key) {
  return (state.awakening?.[key] || 0) * AWAKENING[key].perLevel;
}

export function setCounts(gear) {
  const counts = {};
  for (const slot of SLOT_KEYS) {
    const id = gear[slot]?.setId;
    if (id) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

// Tous les effets actifs d'un héros, avec leur provenance.
export function heroEffects(hero, gear = hero.gear) {
  const fx = addEffects({}, CLASSES[hero.classId].passive);
  const spec = hero.specs?.[hero.classId];
  if (spec != null) addEffects(fx, SPECS[hero.classId][spec]);
  const uniques = new Set();
  for (const slot of SLOT_KEYS) {
    const item = gear[slot];
    if (!item) continue;
    addEffects(fx, item.affixes);
    if (item.classAffix?.classId === hero.classId) addEffects(fx, item.classAffix.fx);
    if (item.unique && !uniques.has(item.unique)) {
      uniques.add(item.unique);
      addEffects(fx, UNIQUES[item.unique]);
    }
  }
  const sets = setCounts(gear);
  for (const [id, count] of Object.entries(sets)) {
    if (count >= 2) addEffects(fx, SETS[id][2]);
    if (count >= 4) addEffects(fx, SETS[id][4]);
  }
  return { fx, sets, uniques: [...uniques] };
}

function teamEffect(state, key) {
  return state.heroes.reduce((total, h) => total + (heroEffects(h).fx[key] || 0), 0);
}

export function computeHero(hero, state, gearOverride = null, b = B) {
  const role = ROLES[hero.role];
  const gear = gearOverride || hero.gear;
  const { fx, sets, uniques } = heroEffects(hero, gear);
  const k = K(hero.level, b);

  let hp = role.base.hp * k;
  let power = role.base.power * k;
  let armor = role.base.armor * k;
  for (const slot of SLOT_KEYS) {
    const item = gear[slot];
    if (!item) continue;
    hp += itemStat(item, "hp", b) * HP_PER_POINT;
    power += itemStat(item, "power", b);
    armor += itemStat(item, "armor", b);
  }

  const vitality = awakeningBonus(state, "vitality");
  // Bonus permanents : codex et étoiles de Transcendance (multiplicatifs).
  const permanent = (1 + codexBonus(state)) * (1 + starBonus(state));
  power *= (1 + (fx.powerPct || 0) + awakeningBonus(state, "might")) * permanent;
  hp *= (1 + (fx.hpPct || 0) + vitality) * permanent;
  armor *= 1 + (fx.armorPct || 0) + vitality;
  const haste = (fx.haste || 0) + teamEffect(state, "teamHaste");

  return {
    hp: Math.round(hp),
    power,
    armor,
    crit: Math.min(0.75, b.critChance + (fx.crit || 0)),
    critMult: b.critMultiplier + (fx.critDmg || 0),
    haste,
    fortune: fx.fortune || 0,
    attackInterval: b.heroAttackInterval / (1 + haste),
    fx,
    sets,
    uniques,
  };
}

// Puissance estimée : une seule mesure pour l'affichage et les conseils.
// Elle tient compte des effets, mais reste une estimation : c'est au joueur
// de juger si un effet colle à son équipe.
const ROLE_WEIGHTS = { tank: 0.3, dps: 0.75, mage: 0.75, heal: 0.6 };

export function heroStrength(hero, state, gearOverride = null, b = B) {
  const s = computeHero(hero, state, gearOverride, b);
  const fx = s.fx;
  let offense = s.power * (1 + s.crit * (s.critMult - 1)) * (1 + s.haste);
  offense *= 1 + (fx.doubleStrike || 0);
  offense *= 1 + (fx.cleave || 0) * 0.6 + (fx.chain || 0) * 0.35;
  offense *= 1 + (fx.burn || 0) + (fx.executioner || 0) * 0.2 + (fx.frenzy || 0) * 4;
  if (hero.role === "heal") offense *= 1 + (fx.healPct || 0) + (fx.healSplash || 0) * 0.5;
  offense *= 1 + (fx.thorns || 0) * 0.3 + (fx.retaliate || 0) * 0.3;

  const reduction = damageReduction(s.armor, Math.max(1, state.zone?.level || hero.level), b);
  let defense = s.hp / HP_PER_POINT / (1 - reduction);
  defense /= 1 - Math.min(0.5, fx.block || 0);
  defense *= 1 + (fx.lifesteal || 0) * 2 + (fx.phoenix ? 0.25 : 0) + (fx.guard || 0);

  const w = ROLE_WEIGHTS[hero.role];
  return Math.pow(offense, w) * Math.pow(defense, 1 - w);
}

export function teamStrength(state, b = B) {
  return state.heroes.reduce((t, h) => t + heroStrength(h, state, null, b), 0);
}

export function gainFromItem(hero, item, state, b = B) {
  const before = heroStrength(hero, state, null, b);
  const after = heroStrength(hero, state, { ...hero.gear, [item.slot]: item }, b);
  return after / before - 1;
}
