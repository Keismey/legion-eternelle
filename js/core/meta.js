// Progression longue : objectifs quotidiens, codex de collection, Transcendance.
import { UNIQUES, SLOT_KEYS } from "../data/config.js";
import { SETS } from "../data/bosses.js";
import { goldPerMonster } from "./curve.js";

/* ---------- Objectifs quotidiens ---------- */
// type → objectif de base ; `needs` : condition pour proposer l'objectif.
export const QUEST_TYPES = {
  kills: { target: 200 },
  elites: { target: 4 },
  ultimates: { target: 15 },
  lairBoss: { target: 3, needs: (s) => s.bossesDefeated.length > 0 },
  campaignBoss: { target: 2 },
  forge: { target: 5 },
  salvage: { target: 10 },
};
export const QUEST_REWARD = { shards: 30, goldWaves: 40 };

export const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function refreshQuests(state, date = new Date()) {
  const day = todayKey(date);
  if (state.quests?.day === day) return false;
  const rng = seeded(day);
  const pool = Object.keys(QUEST_TYPES).filter((k) => !QUEST_TYPES[k].needs || QUEST_TYPES[k].needs(state));
  const picked = [];
  while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  state.quests = { day, list: picked.map((type) => ({ type, target: QUEST_TYPES[type].target, progress: 0, claimed: false })) };
  return true;
}

export function questProgress(state, type, amount = 1) {
  for (const q of state.quests?.list || []) {
    if (q.type === type && !q.claimed) q.progress = Math.min(q.target, q.progress + amount);
  }
}

export function questReward(state) {
  return { shards: QUEST_REWARD.shards, gold: Math.round(goldPerMonster(state.maxLevel) * QUEST_REWARD.goldWaves) };
}

export function claimQuest(state, index) {
  const q = state.quests?.list[index];
  if (!q || q.claimed || q.progress < q.target) return null;
  const reward = questReward(state);
  q.claimed = true;
  state.shards = (state.shards || 0) + reward.shards;
  state.gold += reward.gold;
  return reward;
}

/* ---------- Codex de collection ---------- */
// Chaque entrée découverte donne un bonus permanent (survit à l'Éveil et à la Transcendance).
export const CODEX_BONUS = 0.01;

export function emptyCodex() {
  return { uniques: [], sets: [] };
}

export function noteItem(state, item) {
  if (item?.unique && !state.codex.uniques.includes(item.unique)) {
    state.codex.uniques.push(item.unique);
    return { kind: "unique", id: item.unique };
  }
  return null;
}

// Un set est « complété » quand un héros en porte les 5 pièces en même temps.
export function noteSets(state) {
  const found = [];
  for (const hero of state.heroes) {
    const ids = SLOT_KEYS.map((s) => hero.gear[s]?.setId);
    const id = ids[0];
    if (id && ids.every((x) => x === id) && !state.codex.sets.includes(id)) {
      state.codex.sets.push(id);
      found.push({ kind: "set", id });
    }
  }
  return found;
}

export function codexCount(state) {
  return (state.codex?.uniques.length || 0) + (state.codex?.sets.length || 0) + state.bossesDefeated.length;
}
export const codexTotal = () => Object.keys(UNIQUES).length + Object.keys(SETS).length * 2;
export const codexBonus = (state) => codexCount(state) * CODEX_BONUS;

/* ---------- Transcendance ---------- */
export const TRANSCEND = { minLevel: 120, soulsPerStar: 120, power: 0.25, souls: 0.2 };

export const starBonus = (state) => (state.stars || 0) * TRANSCEND.power;
export const soulBonus = (state) => 1 + (state.stars || 0) * TRANSCEND.souls;

// extraSouls : les âmes de l'Éveil en cours, comptées elles aussi.
export function pendingStars(state, extraSouls = 0) {
  if (state.maxLevel < TRANSCEND.minLevel) return 0;
  return Math.max(1, Math.floor(((state.cycleSouls || 0) + extraSouls) / TRANSCEND.soulsPerStar));
}
