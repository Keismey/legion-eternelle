// Où se bat l'équipe : la campagne (progression) ou un repaire de boss (chasse au set).
import { BALANCE as B, MODIFIERS } from "../data/config.js";
import { BOSSES, bossForLevel, isCorrupted } from "../data/bosses.js";
import { isBossLevel } from "./curve.js";
import { floorLevel, TRIAL } from "./challenges.js";

export function activeZone(state, b = B) {
  if (state.trial?.active) {
    const floor = state.trial.floor;
    const level = floorLevel(floor);
    const bossWave = floor % TRIAL.bossEvery === 0;
    const boss = bossWave ? BOSSES[(floor / TRIAL.bossEvery - 1) % BOSSES.length] : null;
    return { kind: "trial", level, wave: 0, floor, boss, bossWave, corrupted: isCorrupted(level) };
  }
  if (state.hunt) {
    const boss = BOSSES.find((x) => x.id === state.hunt.bossId);
    return { kind: "hunt", level: state.hunt.level, wave: state.hunt.wave, boss, bossWave: state.hunt.wave === b.wavesPerLevel - 1, corrupted: isCorrupted(state.hunt.level) };
  }
  const z = state.zone;
  const bossLevel = isBossLevel(z.level, b);
  return {
    kind: "campaign",
    level: z.level,
    wave: z.wave,
    boss: bossLevel ? bossForLevel(z.level, b.bossEvery) : null,
    // En mode « farm », le boss de campagne n'apparaît jamais.
    bossWave: z.autoAdvance !== false && bossLevel && z.wave === b.wavesPerLevel - 1,
    corrupted: isCorrupted(z.level),
  };
}

export const lairUnlocked = (state, bossId) => state.bossesDefeated.includes(bossId);

export function startHunt(state, bossId, level, mods = []) {
  if (!lairUnlocked(state, bossId)) return false;
  state.hunt = { bossId, level: clampHuntLevel(state, level), wave: 0, mods: [...mods] };
  return true;
}

// Effet cumulé des modificateurs actifs du repaire.
export function huntModifiers(state) {
  const total = { hp: 1, atk: 1, bossTimer: 0, loot: 0, setChance: 0 };
  for (const key of state.hunt?.mods || []) {
    const m = MODIFIERS[key];
    if (!m) continue;
    total.hp *= m.hp || 1;
    total.atk *= m.atk || 1;
    total.bossTimer += m.bossTimer || 0;
    total.loot += m.loot || 0;
    total.setChance += m.setChance || 0;
  }
  return total;
}

export function clampHuntLevel(state, level) {
  return Math.max(1, Math.min(state.maxLevel, Math.round(level)));
}

export function stopHunt(state) {
  state.hunt = null;
}
