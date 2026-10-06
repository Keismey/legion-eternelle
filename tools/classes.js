// Comparatif des classes : chaque classe remplace la classe de départ de son rôle,
// équipement épique +4 au niveau, meilleure spécialisation, ultimes auto.
import { createState } from "../js/core/state.js";
import { createItem } from "../js/core/loot.js";
import { simulateBattle } from "../js/core/combat.js";
import { BALANCE as B, SLOT_KEYS } from "../js/data/config.js";
import { CLASSES, CLASS_KEYS } from "../js/data/classes.js";

function team(L, role, classId, spec) {
  const s = createState();
  s.maxLevel = L; s.zone.level = L; s.zone.wave = B.wavesPerLevel - 1;
  s.awakening.instinct = 1;
  s.heroes.forEach((h) => {
    h.level = L + 3;
    if (h.role === role) { h.classId = classId; if (spec != null) h.specs = { [classId]: spec }; }
    SLOT_KEYS.forEach((sl) => { const it = createItem(L, { slot: sl, rarity: "epic", focus: "balanced" }); it.affixes = {}; it.classAffix = null; it.plus = 4; h.gear[sl] = it; });
  });
  return s;
}
function score(L, role, id, spec, N = 40) {
  let wins = 0, t = 0, waveT = 0;
  for (let i = 0; i < N; i++) {
    const b = simulateBattle(team(L, role, id, spec));
    if (b.over === "win") { wins++; t += b.elapsed; }
    const s2 = team(L, role, id, spec); s2.zone.wave = 0;
    waveT += simulateBattle(s2).elapsed;
  }
  return { win: wins / N, bossT: wins ? t / wins : 99, waveT: waveT / N };
}
for (const role of ["tank", "dps", "mage", "heal"]) {
  console.log(`\n== ${role}`);
  for (const id of CLASS_KEYS.filter((c) => CLASSES[c].role === role)) {
    const rows = [];
    for (const L of [45]) {
      const spec = L >= 30 ? [0, 1].map((sp) => ({ sp, ...score(L, role, id, sp, 30) })).sort((a, b) => b.win - a.win || a.bossT - b.bossT)[0] : { sp: null, ...score(L, role, id, null) };
      rows.push(`niv ${L}: boss ${Math.round(spec.win * 100)}% ${spec.bossT.toFixed(0)}s, vague ${spec.waveT.toFixed(1)}s${spec.sp != null ? ` (spé ${spec.sp})` : ""}`);
    }
    console.log(id.padEnd(13), rows.join(" | "));
  }
}
