// Test de fumée : fait tourner main.js avec un faux DOM minimal et
// déclenche toutes les actions de l'interface.
const els = new Map();
function makeEl(id = "") {
  const el = {
    id, hidden: false, textContent: "", value: "1", checked: false, disabled: false, type: "",
    dataset: {}, style: { setProperty() {} }, volume: 1,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    _html: "",
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    append() {}, replaceChildren() {}, remove() {}, focus() {}, setAttribute() {}, addEventListener() {},
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    closest() { return null; }, play() { return Promise.resolve(); }, pause() {},
    get offsetWidth() { return 1; }, nextElementSibling: null,
  };
  return el;
}
const listeners = {};
globalThis.document = {
  hidden: false, title: "", documentElement: { lang: "fr" },
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement() { return makeEl(); },
  querySelectorAll() { return []; },
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
};
globalThis.window = { addEventListener() {}, scrollTo() {}, innerWidth: 400 };
globalThis.matchMedia = () => ({ matches: false });
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: k => delete store[k] };
let frames = 0, rafFn = null;
globalThis.requestAnimationFrame = fn => { rafFn = fn; };

const errors = [];
process.on("unhandledRejection", e => errors.push(e));
// Partie de départ : boss du niveau 5 déjà vaincu, pour tester les repaires.
const { createState } = await import("../js/core/state.js");
const seed = createState();
seed.bossesDefeated = ["ancientGolem"]; seed.maxLevel = 12; seed.bestLevel = 12; seed.zone.level = 12; seed.lastSeen = Date.now();
store.legionEternelle_v2 = JSON.stringify(seed);
await import("../js/main.js");
await new Promise(r => setTimeout(r, 50));

let now = 0;
const html = id => document.getElementById(id).innerHTML;
function click0(action, data = {}) { const el = makeEl(); el.dataset = { action, ...data }; listeners.click.forEach(fn => fn({ target: { closest: sel => (sel === "[data-action]" ? el : null) } })); }
click0("speed", { speed: "10" });
for (let i = 0; i < 4000; i++) { now += 100; const f = rafFn; rafFn = null; f(now); frames++; if (i % 50 === 0) for (let h = 0; h < 4; h++) click0("ult", { index: String(h) }); }
console.log("zone:", document.getElementById("zoneLevel").textContent, "| or:", document.getElementById("gold").textContent);

// Cliquer sur toutes les actions présentes dans chaque écran
function click(action, data = {}) {
  const el = makeEl(); el.dataset = { action, ...data };
  el.closest = sel => (sel === "[data-action]" ? el : null);
  const target = { closest: sel => (sel === "[data-action]" ? el : null) };
  listeners.click.forEach(fn => fn({ target }));
}
function nav(tab) {
  const el = makeEl(); el.dataset = { nav: tab };
  listeners.click.forEach(fn => fn({ target: { closest: sel => (sel === "[data-nav]" ? el : null) } }));
}
for (const tab of ["team", "bag", "awaken", "challenges", "combat"]) nav(tab);
nav("team");
for (let i = 0; i < 4; i++) click("pickHero", { index: String(i) });
click("slotSheet", { slot: "gloves" }); click("forge", { slot: "gloves" }); click("reroll", { slot: "gloves" }); click("unequip", { slot: "boots" });
click("classSheet"); click("setClass", { class: "guardian" }); click("closeSheet");
click("zoneSheet"); click("huntLevel", { step: "-5" });
console.log("repaires:", (html("sheetBody").match(/data-action="startHunt"/g) || []).length, "ouverts");
const lair = html("sheetBody").match(/data-action="startHunt" data-boss="(\w+)"/);
if (lair) click("startHunt", { boss: lair[1] });
for (let i = 0; i < 1500; i++) { now += 100; rafFn(now); }
console.log("zone (chasse):", document.getElementById("zoneMode").textContent, document.getElementById("zoneLevel").textContent);
nav("bag");
const bag = html("tab-bag");

const tiles = [...bag.matchAll(/data-action="itemSheet" data-id="([^"]+)"/g)];
console.log("tuiles dans le sac:", tiles.length);
if (tiles[0]) { click("itemSheet", { id: tiles[0][1] }); console.log("fiche objet:", html("sheetBody").includes("compare") ? "comparaison OK" : "pas de comparaison"); click("compareHero", { index: "2", id: tiles[0][1] }); click("lockItem", { id: tiles[0][1] }); click("equipItem", { id: tiles[0][1], hero: "2" }); }
click("salvageItem", { id: tiles[1]?.[1] }); click("craftSet", { set: "ancientGolem" }); click("craftSlot", { slot: "boots" }); click("salvageAll"); click("craft"); click("revealNext");
console.log("éclats après recyclage:", html("tab-bag").match(/shard-icon[^>]*><\/span><span class="num">([^<]+)/)?.[1]);
click("classSheet"); click("setSpec", { spec: "1" }); click("closeSheet");
click("zoneSheet"); click("toggleMod", { mod: "horde" }); click("toggleMod", { mod: "rush" }); click("closeSheet");
click("bagFilter", { filter: "boots" }); click("bagFilter", { filter: "all" }); click("leaveHunt");
click("toggleAutoSell", { rarity: "rare" }); click("sellAll");
nav("awaken"); click("awaken"); click("awakenCancel"); click("buyUpgrade", { key: "might" });
click("settings"); click("replayTutorial");
click("settings"); click("lang", { lang: "en" }); click("reset"); click("cancelReset"); click("lang", { lang: "fr" }); click("closeSheet");
click("farm"); click("challenge");
click("startTrial");
for (let i = 0; i < 3000; i++) { now += 100; rafFn(now); }
console.log("tour:", document.getElementById("zoneMode").textContent, document.getElementById("zoneLevel").textContent);
click("leaveTrial");
nav("challenges"); console.log("défis:", (html("tab-challenges").match(/class="ach done"/g) || []).length, "succès obtenus");
// Gros saut de temps : déclenche le hors-ligne
now += 3_600_000; rafFn(now);
for (let i = 0; i < 200; i++) { now += 100; const f = rafFn; f(now); }
await new Promise(r => setTimeout(r, 800));
console.log("feuille:", document.getElementById("sheetBody").innerHTML.replace(/\s+/g, " ").slice(0, 160));
console.log("sauvegarde:", Object.keys(store), (store.legionEternelle_v2 || "").length, "octets");
click("resetConfirm");
await new Promise(r => setTimeout(r, 50));
console.log("après effacement:", document.getElementById("zoneLevel").textContent, "| erreurs:", errors.length, errors.map(String));
