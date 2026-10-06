// Simulation d'une partie complète en accéléré : node tools/simulate.js [heures]
import { createState } from "../js/core/state.js";
import { createGame, awaken, pendingSouls, buyAwakening, awakeningCost, transcend, starsAvailable } from "../js/core/game.js";
import { codexCount } from "../js/core/meta.js";
import { forgeItem, canForge } from "../js/core/loot.js";
import { forgeCost } from "../js/core/curve.js";
import { teamStrength } from "../js/core/heroes.js";
import { startHunt, stopHunt } from "../js/core/zones.js";
import { SLOT_KEYS, AWAKENING, BALANCE } from "../js/data/config.js";

const hours = Number(process.argv[2] || 6);
// TUNE='{"ultCharge":{"action":8}}' : essai de réglages sans toucher à config.js
if (process.env.TUNE) {
  const merge = (dst, src) => { for (const [k, v] of Object.entries(src)) v && typeof v === "object" ? merge(dst[k], v) : (dst[k] = v); };
  merge(BALANCE, JSON.parse(process.env.TUNE));
}
const state = createState();
state.settings.autoEquip = true;
// ULT=none : joueur absent, aucun ultime avant d'avoir acheté l'Instinct (lancement auto).
if (process.env.ULT !== "none") state.awakening.instinct = 1; // sinon : le joueur lance tout, au bon moment
const HUNT = process.argv.includes("--hunt");
let defeats = 0, bossFails = 0;
const game = createGame(state, { onEvent: (t, d) => { if (t === "defeat") { defeats++; if (d.boss) bossFails++; } } });

const forgeAll = () => {
  for (;;) {
    let best = null;
    for (const h of state.heroes) for (const s of SLOT_KEYS) {
      const it = h.gear[s];
      if (it && canForge(it) && (!best || forgeCost(it) < forgeCost(best))) best = it;
    }
    if (!best || !forgeItem(state, best)) break;
  }
};
const spendSouls = () => {
  for (;;) {
    const keys = Object.keys(AWAKENING).filter(k => state.souls >= awakeningCost(state, k) && !(AWAKENING[k].max && state.awakening[k] >= AWAKENING[k].max));
    if (!keys.length) break;
    keys.sort((a, b) => awakeningCost(state, a) - awakeningCost(state, b));
    buyAwakening(state, keys[0]);
  }
};

let t = 0, lastBest = 0, lastProgressT = 0;
const dt = 0.1;
const fmt = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, "0")}`;
while (t < hours * 3600) {
  game.update(dt); t += dt;
  if (Math.round(t * 10) % 300 === 0) forgeAll();
  if (state.maxLevel > lastBest) { lastBest = state.maxLevel; lastProgressT = t; }
  // Stratégie de chasse : bloqué depuis 10 min → 15 min dans le dernier repaire débloqué
  if (HUNT && !state.hunt && !state.zone.autoAdvance && t - lastProgressT > 600 && state.bossesDefeated.length && (t - (globalThis.lastHunt || -1e9)) > 1800) {
    startHunt(state, state.bossesDefeated[state.bossesDefeated.length - 1], state.maxLevel - 2); globalThis.lastHunt = t; game.restart();
  }
  if (state.hunt && t - globalThis.lastHunt > 900) { stopHunt(state); game.restart(); }
  if (t - lastProgressT > 1800 && starsAvailable(state) > 0) {
    const ml = state.maxLevel; const n = transcend(state); spendSouls();
    console.log(`  🌟 Transcendance à ${fmt(t)} : max ${ml}, +${n} étoiles (total ${state.stars}), codex ${codexCount(state)}`);
    lastBest = 0; lastProgressT = t; game.restart();
  }
  if (t - lastProgressT > 1800 && pendingSouls(state) > 0) {
    const ml = state.maxLevel; const s = awaken(state); spendSouls();
    console.log(`  ⟳ Éveil #${state.awakenings} à ${fmt(t)} : max ${ml}, +${s} âmes (cycle ${state.cycleSouls}), codex ${codexCount(state)}`);
    lastBest = 0; lastProgressT = t; game.restart();
  }
  if (Math.round(t * 10) % 6000 === 0) {
    const gear = state.heroes.flatMap(h => SLOT_KEYS.map(s => h.gear[s])).filter(Boolean);
    const avgLvl = gear.length ? (gear.reduce((a, i) => a + i.level, 0) / gear.length).toFixed(1) : 0;
    const avgPlus = gear.length ? (gear.reduce((a, i) => a + i.plus, 0) / gear.length).toFixed(1) : 0;
    const rar = {}; gear.forEach(i => rar[i.rarity] = (rar[i.rarity] || 0) + 1); rar.hunt = state.hunt ? 1 : 0;
    console.log(`${fmt(t)} niv ${state.zone.level}.${state.zone.wave} max ${state.maxLevel} | héros ${state.heroes[0].level} | stuff niv ${avgLvl} +${avgPlus} ${JSON.stringify(rar)} | or ${state.gold} | vague ${state.stats.waveSeconds.toFixed(1)}s | défaites ${defeats} (boss ${bossFails}) | ${state.zone.autoAdvance ? "avance" : "farm"}`);
  }
}
