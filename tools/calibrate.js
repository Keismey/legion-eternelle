// Taux de victoire contre les vagues et les boss selon le niveau et la qualité du stuff.
import { createState } from "../js/core/state.js";
import { createItem } from "../js/core/loot.js";
import { simulateBattle } from "../js/core/combat.js";
import { BALANCE as B, SLOT_KEYS } from "../js/data/config.js";

function team(level, heroLevel, rank, plus) {
  const s = createState();
  s.maxLevel = level; s.zone.level = level;
  s.heroes.forEach(h => { h.level = heroLevel; SLOT_KEYS.forEach(sl => { const it = createItem(level, { slot: sl, rarity: ["common","rare","epic","legendary"][rank] }); it.plus = plus; h.gear[sl] = it; }); });
  return s;
}
const rows = [];
for (const L of [5, 10, 20, 30, 40, 60, 80, 100]) {
  const line = [`niv ${String(L).padStart(3)}`];
  for (const [rank, plus, label] of [[0,0,"commun+0"],[1,2,"rare+2"],[2,4,"épique+4"],[3,6,"légend+6"]]) {
    let wins = 0, bw = 0, causes = {}, wt = 0, bt = 0; const N = 30;
    for (let i = 0; i < N; i++) {
      const s = team(L, L + 3, rank, plus); s.zone.wave = 0;
      const w = simulateBattle(s); if (w.over === "win") { wins++; wt += w.elapsed; }
      const s2 = team(L, L + 3, rank, plus); s2.zone.wave = B.wavesPerLevel - 1; s2.zone.level = Math.ceil(L / 5) * 5;
      const b = simulateBattle(s2); if (b.over === "win") { bw++; bt += b.elapsed; } else causes[b.over] = (causes[b.over] || 0) + 1;
    }
    line.push(`${label}: vague ${Math.round(wins/N*100)}% ${(wt/Math.max(1,wins)).toFixed(0)}s · boss ${Math.round(bw/N*100)}% ${(bt/Math.max(1,bw)).toFixed(0)}s ${Object.entries(causes).map(([k,v])=>k[0]+v).join("")}`);
  }
  console.log(line.join(" | "));
}
