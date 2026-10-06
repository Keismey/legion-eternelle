// Butin : création d'objets, équipement automatique, vente et forge.
import { BALANCE as B, RARITIES, SLOTS, SLOT_KEYS, AFFIXES, FOCUS, UNIQUES, CRAFT } from "../data/config.js";
import { CLASS_AFFIXES, CLASS_AFFIX_CHANCE } from "../data/specs.js";
import { K, itemBudget, sellValue, forgeCost } from "./curve.js";
import { gainFromItem, awakeningBonus } from "./heroes.js";

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const rand = (min, max, rng) => min + rng() * (max - min);

export function rollRarity(luck = 0, minRank = 0, rng = Math.random) {
  const pool = RARITIES.map((r, rank) => ({ r, w: rank < minRank ? 0 : r.weight * Math.max(0, 1 + luck * rank) }));
  let roll = rng() * pool.reduce((t, p) => t + p.w, 0);
  for (const p of pool) {
    roll -= p.w;
    if (p.w > 0 && roll <= 0) return p.r;
  }
  return pool[pool.length - 1].r;
}

function pickWeighted(entries, rng) {
  let roll = rng() * entries.reduce((t, [, w]) => t + w, 0);
  for (const [key, w] of entries) {
    roll -= w;
    if (w > 0 && roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function splitBudget(slotKey, focusKey) {
  const base = SLOTS[slotKey];
  const focus = FOCUS[focusKey];
  let { hp, power, armor } = base;
  if (focusKey === "offense") {
    const moved = (hp + armor) * focus.shift;
    power += moved;
    hp *= 1 - focus.shift;
    armor *= 1 - focus.shift;
  } else if (focusKey === "defense") {
    const moved = power * focus.shift;
    power -= moved;
    const def = hp + armor;
    hp += (moved * hp) / def;
    armor += (moved * armor) / def;
  }
  return { hp, power, armor };
}

export function createItem(level, { luck = 0, minRank = 0, slot = null, rarity: forced = null, setId = null, focus = null, rng = Math.random } = {}, b = B) {
  const rarity = setId ? RARITIES.find((r) => r.key === "set") : RARITIES.find((r) => r.key === forced) || rollRarity(luck, minRank, rng);
  const slotKey = slot || SLOT_KEYS[Math.floor(rng() * SLOT_KEYS.length)];
  const focusKey = focus || (rarity.key === "common" ? "balanced" : pickWeighted(Object.entries(FOCUS).map(([k, f]) => [k, f.weight]), rng));
  const budget = itemBudget(level, rarity.key, b) * rand(0.85, 1.15, rng);
  const split = splitBudget(slotKey, focusKey);
  const affixes = {};
  const affixKeys = Object.keys(AFFIXES).sort(() => rng() - 0.5).slice(0, rarity.affixes);
  for (const key of affixKeys) affixes[key] = +rand(AFFIXES[key].min, AFFIXES[key].max, rng).toFixed(3);
  const unique = rarity.unique ? Object.keys(UNIQUES)[Math.floor(rng() * Object.keys(UNIQUES).length)] : null;
  let classAffix = null;
  if (["epic", "legendary", "set"].includes(rarity.key) && rng() < CLASS_AFFIX_CHANCE) {
    const classes = Object.keys(CLASS_AFFIXES);
    const classId = classes[Math.floor(rng() * classes.length)];
    const scale = rand(0.7, 1.3, rng);
    classAffix = { classId, fx: Object.fromEntries(Object.entries(CLASS_AFFIXES[classId]).map(([k, v]) => [k, +(v * scale).toFixed(3)])) };
  }

  return {
    id: uid(),
    slot: slotKey,
    level,
    rarity: rarity.key,
    focus: focusKey,
    plus: 0,
    hp: +(budget * split.hp).toFixed(2),
    power: +(budget * split.power).toFixed(2),
    armor: +(budget * split.armor).toFixed(2),
    affixes,
    unique,
    classAffix,
    setId,
    locked: false,
    isNew: true,
  };
}

export function starterGear(level) {
  return Object.fromEntries(SLOT_KEYS.map((slot) => [slot, { ...createItem(level, { slot, rarity: "common" }), isNew: false }]));
}

export function lootLuck(state) {
  return awakeningBonus(state, "luck");
}

// Trouve le héros qui gagne le plus avec cet objet (ou null).
export function bestHeroFor(item, state) {
  let best = null;
  for (const hero of state.heroes) {
    const gain = gainFromItem(hero, item, state);
    if (gain > 0.001 && (!best || gain > best.gain)) best = { hero, gain };
  }
  return best;
}

export function equip(state, hero, item) {
  const previous = hero.gear[item.slot];
  item.isNew = false;
  hero.gear[item.slot] = item;
  state.inventory = state.inventory.filter((i) => i.id !== item.id);
  if (previous) state.inventory.push(previous);
  return previous;
}

export function unequip(state, hero, slot) {
  const item = hero.gear[slot];
  if (!item || state.inventory.length >= B.inventorySize) return false;
  hero.gear[slot] = null;
  state.inventory.push(item);
  return true;
}

export function sellItem(state, item) {
  if (item.locked) return 0;
  const value = sellValue(item);
  state.inventory = state.inventory.filter((i) => i.id !== item.id);
  state.gold += value;
  return value;
}

// Nouvel objet : équipé s'il améliore quelqu'un, sinon rangé ou vendu.
export function receiveItem(state, item) {
  if (state.settings.autoEquip) {
    const best = bestHeroFor(item, state);
    if (best) {
      const previous = equip(state, best.hero, { ...item });
      state.inventory = state.inventory.filter((i) => i.id !== item.id);
      if (previous && !previous.locked && state.settings.autoSell.includes(previous.rarity)) sellItem(state, previous);
      return { outcome: "equipped", hero: best.hero, gain: best.gain };
    }
  }
  if (state.settings.autoSell.includes(item.rarity)) {
    state.inventory.push(item);
    return { outcome: "sold", gold: sellItem(state, item) };
  }
  if (state.inventory.length >= B.inventorySize) {
    // Sac plein : on garde le meilleur des deux entre le nouvel objet
    // et le moins bon objet non verrouillé du sac.
    const worst = state.inventory.filter((i) => !i.locked).sort((a, b) => itemValue(a) - itemValue(b))[0];
    if (!worst || itemValue(worst) >= itemValue(item)) {
      state.inventory.push(item);
      return { outcome: "sold", gold: sellItem(state, item) };
    }
    sellItem(state, worst);
  }
  state.inventory.push(item);
  return { outcome: "stored" };
}

const RANK = Object.fromEntries(RARITIES.map((r, i) => [r.key, i]));
const itemValue = (item) => (RANK[item.rarity] + (item.setId ? 1 : 0)) * 1000 + item.level;

export function canForge(item, b = B) {
  return item && (item.plus || 0) < b.forgeMax;
}

export function forgeItem(state, item) {
  if (!canForge(item)) return false;
  const cost = forgeCost(item);
  if (state.gold < cost) return false;
  state.gold -= cost;
  item.plus = (item.plus || 0) + 1;
  state.stats.forges = (state.stats.forges || 0) + 1;
  return true;
}

// Retouche : remplace un effet au hasard par un autre (coût croissant).
export const rerollCost = (item, b = B) =>
  Math.round(b.forgeBaseCost * 2.5 * K(item.level, b) * Math.pow(1.6, item.rerolls || 0));

export function canReroll(item) {
  return item && Object.keys(item.affixes || {}).length > 0;
}

export function rerollAffix(state, item, rng = Math.random) {
  if (!canReroll(item)) return null;
  const cost = rerollCost(item);
  if (state.gold < cost) return null;
  const current = Object.keys(item.affixes);
  const removed = current[Math.floor(rng() * current.length)];
  const pool = Object.keys(AFFIXES).filter((k) => !current.includes(k));
  const added = pool[Math.floor(rng() * pool.length)];
  state.gold -= cost;
  delete item.affixes[removed];
  item.affixes[added] = +rand(AFFIXES[added].min, AFFIXES[added].max, rng).toFixed(3);
  item.rerolls = (item.rerolls || 0) + 1;
  return { removed, added };
}

// Recyclage : détruit un objet du sac contre des éclats.
export const salvageValue = (item) => CRAFT.salvage[item.setId ? "set" : item.rarity] || 1;

export function salvageItem(state, item) {
  if (!item || item.locked) return 0;
  const shards = salvageValue(item);
  state.inventory = state.inventory.filter((i) => i.id !== item.id);
  state.shards = (state.shards || 0) + shards;
  return shards;
}

// Fabrication : une pièce de set précise, au niveau max atteint.
export function canCraft(state, setId) {
  return state.bossesDefeated.includes(setId) && (state.shards || 0) >= CRAFT.setCost && state.inventory.length < B.inventorySize;
}

export function craftSetPiece(state, setId, slot) {
  if (!canCraft(state, setId)) return null;
  state.shards -= CRAFT.setCost;
  const item = createItem(state.maxLevel, { setId, slot });
  state.inventory.push(item);
  return item;
}
