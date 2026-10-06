// Défis : succès permanents et tour d'épreuves hebdomadaire.
import { SLOT_KEYS } from "../data/config.js";
import { CLASS_KEYS } from "../data/classes.js";
import { isClassUnlocked } from "./state.js";
import { codexCount, codexTotal } from "./meta.js";

/* ---------- Succès ---------- */
const maxPlus = (s) =>
  Math.max(0, ...s.heroes.flatMap((h) => SLOT_KEYS.map((k) => h.gear[k]?.plus || 0)), ...s.inventory.map((i) => i.plus || 0));
const st = (s, k) => s.stats[k] || 0;

// value(state) → progression actuelle ; target : objectif ; shards : récompense.
export const ACHIEVEMENTS = [
  { id: "level10", value: (s) => s.bestLevel, target: 10, shards: 10 },
  { id: "level25", value: (s) => s.bestLevel, target: 25, shards: 20 },
  { id: "level50", value: (s) => s.bestLevel, target: 50, shards: 40 },
  { id: "level100", value: (s) => s.bestLevel, target: 100, shards: 80 },
  { id: "level150", value: (s) => s.bestLevel, target: 150, shards: 150 },
  { id: "boss1", value: (s) => st(s, "bossKills"), target: 1, shards: 10 },
  { id: "boss100", value: (s) => st(s, "bossKills"), target: 100, shards: 60 },
  { id: "corrupt1", value: (s) => st(s, "corruptedKills"), target: 1, shards: 50 },
  { id: "corrupt25", value: (s) => st(s, "corruptedKills"), target: 25, shards: 100 },
  { id: "kills1000", value: (s) => st(s, "kills"), target: 1000, shards: 20 },
  { id: "kills25000", value: (s) => st(s, "kills"), target: 25000, shards: 60 },
  { id: "elites50", value: (s) => st(s, "elites"), target: 50, shards: 30 },
  { id: "legendary1", value: (s) => st(s, "legendaries"), target: 1, shards: 15 },
  { id: "set1", value: (s) => s.codex.sets.length, target: 1, shards: 40 },
  { id: "codexAll", value: (s) => codexCount(s), target: codexTotal(), shards: 150 },
  { id: "forge10", value: maxPlus, target: 10, shards: 40 },
  { id: "ult100", value: (s) => st(s, "ultimates"), target: 100, shards: 30 },
  { id: "combo50", value: (s) => st(s, "combos"), target: 50, shards: 40 },
  { id: "awaken1", value: (s) => s.awakenings, target: 1, shards: 30 },
  { id: "awaken10", value: (s) => s.awakenings, target: 10, shards: 100 },
  { id: "transcend1", value: (s) => s.stars || 0, target: 1, shards: 150 },
  { id: "classesAll", value: (s) => CLASS_KEYS.filter((id) => isClassUnlocked(s, id)).length, target: CLASS_KEYS.length, shards: 80 },
  { id: "trial10", value: (s) => s.trialBestEver || 0, target: 10, shards: 30 },
  { id: "trial25", value: (s) => s.trialBestEver || 0, target: 25, shards: 60 },
  { id: "trial50", value: (s) => s.trialBestEver || 0, target: 50, shards: 120 },
];

// Débloque les succès atteints ; renvoie les nouveaux.
export function checkAchievements(state) {
  state.achievements ||= [];
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.includes(a.id)) continue;
    if (a.value(state) >= a.target) {
      state.achievements.push(a.id);
      state.shards = (state.shards || 0) + a.shards;
      fresh.push(a);
    }
  }
  return fresh;
}

/* ---------- Tour d'épreuves ---------- */
// Deux règles par semaine, tirées à partir du numéro de semaine.
export const TRIAL_RULES = {
  giants: { hp: 1.6 },
  fury: { atk: 1.5 },
  noHeal: { noHeal: true },
  fragile: { heroHp: 0.7 },
  swift: { monsterSpeed: 0.7 },
  bloodlust: { crit: 0.25, atk: 1.2 },
  noUlt: { noUlt: true },
};
export const TRIAL = { baseLevel: 8, perFloor: 2, bossEvery: 5 };

export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function weeklyRules(week) {
  const keys = Object.keys(TRIAL_RULES);
  const h = hash(week);
  const first = keys[h % keys.length];
  const rest = keys.filter((k) => k !== first);
  return [first, rest[(h >>> 8) % rest.length]];
}

export function refreshTrial(state, date = new Date()) {
  const week = weekKey(date);
  if (state.trial?.week === week) return false;
  state.trial = { week, best: 0, active: false, floor: 0, rules: weeklyRules(week) };
  return true;
}

export const floorLevel = (floor) => TRIAL.baseLevel + TRIAL.perFloor * floor;

export function trialRules(state) {
  const total = { hp: 1, atk: 1, heroHp: 1, monsterSpeed: 1, crit: 0, noHeal: false, noUlt: false };
  for (const key of state.trial?.rules || []) {
    const r = TRIAL_RULES[key];
    total.hp *= r.hp || 1;
    total.atk *= r.atk || 1;
    total.heroHp *= r.heroHp || 1;
    total.monsterSpeed *= r.monsterSpeed || 1;
    total.crit += r.crit || 0;
    total.noHeal ||= Boolean(r.noHeal);
    total.noUlt ||= Boolean(r.noUlt);
  }
  return total;
}

export function startTrial(state) {
  refreshTrial(state);
  state.hunt = null;
  state.trial.active = true;
  state.trial.floor = 1;
}

export function endTrial(state) {
  if (state.trial) state.trial.active = false;
}

// Récompense d'un étage franchi : des éclats, et un légendaire tous les 5 étages.
export const floorShards = (floor) => 2 + Math.ceil(floor / 2);
