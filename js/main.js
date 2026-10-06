// Point d'entrée : charge la sauvegarde, lance la boucle, relie l'interface.
import { t, setLanguage, LANGUAGES } from "./data/i18n.js";
import { createState, migrate, isClassUnlocked } from "./core/state.js";
import { createStorage, hasLegacySave } from "./core/storage.js";
import { createGame, computeOffline, awaken, buyAwakening, pendingSouls, autoUltimateUnlocked, transcend } from "./core/game.js";
import { refreshQuests, questProgress, claimQuest, noteSets } from "./core/meta.js";
import { checkAchievements, refreshTrial, startTrial, endTrial, ACHIEVEMENTS } from "./core/challenges.js";
import { equip, unequip, sellItem, forgeItem, rerollAffix, salvageItem, craftSetPiece } from "./core/loot.js";
import { SPEC_LEVEL } from "./data/specs.js";
import { gainFromItem } from "./core/heroes.js";
import { startHunt, stopHunt, clampHuntLevel } from "./core/zones.js";
import { mountBattle, updateBattle, battleEvent, flashStatus } from "./ui/battle.js";
import { ui, renderZone, renderTeam, renderBag, renderAwaken, renderQuests, renderChallenges, slotSheet, itemSheet, classSheet, zoneSheet } from "./ui/screens.js";
import { openSheet, refreshSheet, closeSheet, sheetOpen } from "./ui/sheet.js";
import { sfx, setSfx, unlockAudio } from "./ui/sfx.js";
import { itemDetail, bestTarget } from "./ui/screens.js";
import { initTutorial, checkTutorial, tutorialPaused, replayTutorial } from "./ui/tutorial.js";
import { fmt, pct, duration, esc, itemName, className, bgUrl, assetUrl } from "./ui/format.js";

const $ = (id) => document.getElementById(id);
const SAVE_EVERY = 15000;

let state;
let game;
let storage;
let activeTab = "combat";
let dirty = true;
let changed = false;
let lastSave = 0;
let lastFrame = 0;
const feed = [];

/* ---------- Sauvegarde ---------- */
function snapshot() {
  return JSON.parse(JSON.stringify({ ...state, lastSeen: Date.now() }));
}

async function save() {
  if (!storage) return;
  state.lastSeen = Date.now();
  lastSave = performance.now();
  changed = false;
  await storage.save(snapshot());
}

/* ---------- Journal, toast, feuille ---------- */
function log(text, kind = "") {
  feed.unshift({ text, kind });
  feed.length = Math.min(feed.length, 6);
  $("feed").innerHTML = feed.map((f) => `<li class="${f.kind}"><span class="tag" aria-hidden="true"></span><span>${f.text}</span></li>`).join("");
}

let toastTimer;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}


/* ---------- Événements du jeu ---------- */
function onGameEvent(type, data) {
  if (type === "wave") {
    mountBattle(data.battle);
    dirty = true;
    return;
  }
  if (["hit", "heal", "block", "revive", "ultimate", "phase", "combo", "summon", "drain", "bleed", "nova", "reflect"].includes(type)) {
    battleEvent(type, data);
    return;
  }
  if (type === "skill") {
    flashStatus(`⚠ ${t(`skill.${data.bossId}`)}`);
    return;
  }
  if (type === "victory") {
    changed = true;
    dirty = true;
    for (const drop of data.loot) {
      const name = `<span class="r-${drop.item.rarity}">${esc(itemName(drop.item))}</span>`;
      if (drop.outcome === "equipped") log(t("feed.equipped", { item: name, hero: esc(className(drop.hero.classId)), pct: pct(drop.gain) }), "good");
      else if (drop.outcome === "stored") log(t(drop.item.setId ? "feed.setPiece" : "feed.found", { item: name }), drop.item.setId || drop.item.rarity === "legendary" ? "boss" : "");
      else if (drop.item.rarity !== "common") log(t("feed.sold", { item: name, gold: fmt(drop.gold) }), "gold");
    }
    if (data.isBoss) log(t("feed.bossWin", { boss: t(`boss.${data.boss.id}`) }), "boss");
    data.codex.forEach(announceCodex);
    // Révélation des belles prises, son selon la rareté
    const special = data.loot.filter((d) => d.outcome !== "sold" && (d.item.rarity === "legendary" || d.item.setId));
    special.forEach((d) => queueReveal(d.item));
    if (data.isBoss) sfx("boss");
    else if (!special.length && data.loot.some((d) => d.outcome !== "sold" && d.item.rarity !== "common")) sfx("loot");
    if (data.levelUp) log(t("feed.zoneUp", { n: state.zone.level }), "gold");
    if (data.lairUnlocked) {
      log(t("feed.lairOpen", { boss: t(`boss.${data.lairUnlocked}`) }), "boss");
      toast(t("feed.lairOpen", { boss: t(`boss.${data.lairUnlocked}`) }));
    }
    for (const cls of data.unlocked) {
      log(t("feed.unlock", { cls: className(cls) }), "boss");
      toast(t("toast.unlock", { cls: className(cls) }));
    }
    return;
  }
  if (type === "defeat") {
    changed = true;
    dirty = true;
    sfx("defeat");
    if (data.boss) log(t(data.result === "timeout" ? "feed.bossTimeout" : "feed.bossLose", { boss: t(`boss.${data.boss.id}`) }), "bad");
    else if (!data.hunt) log(t("feed.wipe", { n: state.zone.level }), "bad");
    return;
  }
  if (type === "trialFloor") {
    changed = true;
    dirty = true;
    data.loot.forEach((d) => d.outcome !== "sold" && queueReveal(d.item));
    if (data.floor % 5 === 0) {
      log(t("trial.milestone", { n: data.floor }), "boss");
      sfx("boss");
    }
    return;
  }
  if (type === "trialEnd") {
    changed = true;
    dirty = true;
    log(t("trial.ended", { n: data.floor, best: data.best }), "bad");
    toast(t("trial.ended", { n: data.floor, best: data.best }));
    game.restart();
    return;
  }
  if (type === "codexEntry") {
    announceCodex(data);
    return;
  }
  if (type === "autoPush") {
    log(t("feed.autoPush"), "good");
    dirty = true;
    return;
  }
  if (type === "state") dirty = true;
}

function announceCodex(entry) {
  const name = entry.kind === "unique" ? t(`unique.${entry.id}`) : entry.kind === "set" ? t(`set.${entry.id}`) : t(`boss.${entry.id}`);
  log(t("codex.new", { name }), "boss");
  toast(t("codex.new", { name }));
}

/* ---------- Révélation du butin ---------- */
const reveals = [];
function queueReveal(item) {
  reveals.push(item.id);
  if (reveals.length === 1) showReveal();
}

function revealHtml() {
  const id = reveals[0];
  const item = state.inventory.find((i) => i.id === id) || state.heroes.flatMap((h) => Object.values(h.gear)).find((i) => i?.id === id);
  if (!item) return null;
  const inBag = state.inventory.includes(item);
  const best = inBag ? bestTarget(state, item) : null;
  const index = best ? state.heroes.indexOf(best.hero) : -1;
  return `
    <div class="reveal-kicker">${item.setId ? t("reveal.set") : t("reveal.legendary")}</div>
    ${itemDetail(item, best?.hero)}
    <div class="item-actions">
      ${inBag ? `<button class="btn primary" data-action="revealEquip" data-id="${item.id}" data-hero="${index}">${t("sheet.equipOn", { hero: esc(className(best.hero.classId)) })} · <span class="${best.gain > 0 ? "" : "down"}">${best.gain > 0 ? "+" : ""}${pct(best.gain)} %</span></button>` : ""}
      <button class="btn ${inBag ? "ghost" : "primary"}" data-action="revealNext">${inBag ? t("reveal.keep") : t("offline.ok")}</button>
    </div>`;
}

function showReveal() {
  const box = $("reveal");
  while (reveals.length) {
    const html = revealHtml();
    if (html) {
      const item = state.inventory.find((i) => i.id === reveals[0]);
      box.classList.toggle("set", Boolean(item?.setId));
      $("revealBody").innerHTML = html;
      box.hidden = false;
      $("revealBody").querySelector("button")?.focus({ preventScroll: true });
      sfx("legendary");
      return;
    }
    reveals.shift();
  }
  box.hidden = true;
}

function nextReveal() {
  reveals.shift();
  showReveal();
}

/* ---------- Rendu ---------- */
function renderWallet() {
  $("gold").textContent = fmt(state.gold);
  $("souls").textContent = fmt(state.souls);
  $("soulsChip").hidden = !(state.souls > 0 || state.awakenings > 0);

  const fresh = state.inventory.filter((item) => item.isNew).length;
  const upgrades = state.inventory.filter((item) => state.heroes.some((h) => gainFromItem(h, item, state) > 0.001)).length;
  const badge = fresh || upgrades;
  $("bagBadge").hidden = badge === 0;
  $("bagBadge").textContent = badge;
  $("awakenDot").hidden = pendingSouls(state) <= 0;
}

function renderActive() {
  if (activeTab === "challenges") renderChallenges(state);
  else if (activeTab === "team") renderTeam(state);
  else if (activeTab === "bag") renderBag(state);
  else if (activeTab === "awaken") renderAwaken(state);
}

function renderUltRow() {
  const row = $("ultRow");
  const html = autoUltimateUnlocked(state)
    ? `<label class="toggle-row" for="autoUlt"><span class="small-text">${t("ult.auto")}</span><span class="switch"><input type="checkbox" id="autoUlt" data-action="toggleAutoUlt" ${state.settings.autoUltimate ? "checked" : ""}><span></span></span></label>`
    : `<p class="small-text muted">${t("ult.hint")}</p>`;
  if (row.dataset.html !== html) {
    row.innerHTML = html;
    row.dataset.html = html;
  }
}

function announceAchievements() {
  for (const a of checkAchievements(state)) {
    log(t("ach.unlocked", { name: t(`ach.${a.id}`), n: a.shards }), "boss");
    toast(t("ach.unlocked", { name: t(`ach.${a.id}`), n: a.shards }));
    sfx("legendary");
    changed = true;
  }
}

function renderAll() {
  refreshQuests(state);
  refreshTrial(state);
  announceAchievements();
  $("challengeDot").hidden = Boolean(state.trial?.best) || Boolean(state.trial?.active);
  renderZone(state);
  renderWallet();
  renderUltRow();
  renderQuests(state);
  renderActive();
  checkTutorial();
}

// Après une action du joueur : tout l'écran et la fiche ouverte.
function refresh() {
  noteSets(state).forEach(announceCodex);
  changed = true;
  renderAll();
  refreshSheet();
}

function applyStaticTexts() {
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.title = t("app.title");
  $("settingsBtn").setAttribute("aria-label", t("settings.title"));
}

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("active", b.dataset.nav === tab));
  document.querySelectorAll(".tab").forEach((s) => (s.hidden = s.dataset.tab !== tab));
  renderActive();
  window.scrollTo({ top: 0 });
}

/* ---------- Réglages & hors-ligne ---------- */
let confirmReset = false;
function settingsSheet() {
  confirmReset = false;
  openSheet(settingsHtml);
}

function settingsHtml() {
  const langs = Object.keys(LANGUAGES)
    .map((l) => `<button class="chip${state.settings.lang === l ? " on" : ""}" data-action="lang" data-lang="${l}" aria-pressed="${state.settings.lang === l}">${l.toUpperCase()}</button>`)
    .join("");
  const saveKind = { cloud: "settings.saveCloud", local: "settings.saveLocal", memory: "settings.saveMemory" }[storage?.kind || "memory"];
  return `
    <h2>${t("settings.title")}</h2>
    <div class="toggle-row"><span>${t("settings.language")}</span><div class="chips">${langs}</div></div>
    <label class="toggle-row" for="musicToggle"><span>${t("settings.music")}</span>
      <span class="switch"><input type="checkbox" id="musicToggle" data-action="music" ${state.settings.music ? "checked" : ""}><span></span></span>
    </label>
    <label class="toggle-row" for="sfxToggle"><span>${t("settings.sfx")}</span>
      <span class="switch"><input type="checkbox" id="sfxToggle" data-action="sfx" ${state.settings.sfx ? "checked" : ""}><span></span></span>
    </label>
    <div class="toggle-row"><span>${t("settings.save")}</span><span class="muted small-text">${t(saveKind)}</span></div>
    <div class="support">
      <p class="muted small-text">${t("settings.supportHint")}</p>
      <a class="btn full support-btn" href="https://ko-fi.com/keismey" target="_blank" rel="noopener">☕ ${t("settings.support")}</a>
    </div>
    <button class="btn ghost" data-action="replayTutorial">🎓 ${t("settings.tutorial")}</button>
    <div class="item-actions">
      ${confirmReset
        ? `<button class="btn danger" data-action="resetConfirm">${t("settings.resetConfirm")}</button><button class="btn ghost" data-action="cancelReset">${t("awaken.cancel")}</button>`
        : `<button class="btn ghost" data-action="reset">${t("settings.reset")}</button>`}
    </div>
    <button class="btn full" data-action="closeSheet">${t("settings.close")}</button>`;
}

function showOffline(result) {
  if (!result) return;
  openSheet(`
    <h2>${t("offline.title")}</h2>
    <div class="offline-list">
      <span>${t("offline.duration", { d: duration(result.seconds) })}</span>
      <span><b>${t("offline.gold", { n: fmt(result.gold) })}</b></span>
      <span>${t("offline.items", { n: result.items, e: result.equipped })}</span>
      ${result.sets ? `<span>${t("feed.setPiece", { item: result.sets })}</span>` : ""}
    </div>
    <button class="btn primary full" data-action="closeSheet">${t("offline.ok")}</button>`);
  dirty = true;
  changed = true;
}

// Joueur de l'ancienne version : explication et cadeau de bienvenue (une seule fois).
const VETERAN_SHARDS = 50;
function welcomeVeteran() {
  state.shards = (state.shards || 0) + VETERAN_SHARDS;
  changed = true;
  openSheet(`
    <h2>${t("veteran.title")}</h2>
    <p>${t("veteran.text", { n: VETERAN_SHARDS })}</p>
    <button class="btn primary full" data-action="closeSheet">${t("veteran.ok")}</button>`);
  save();
}

/* ---------- Musique ---------- */
function syncMusic() {
  const audio = $("music");
  audio.volume = 0.35;
  if (state.settings.music) audio.play().catch(() => {});
  else audio.pause();
}

/* ---------- Actions ---------- */
const actions = {
  challenge: () => game.challenge(),
  farm: () => game.farm(),
  ult: (el) => {
    if (game.ultimate(Number(el.dataset.index))) changed = true;
  },
  revealEquip: (el) => {
    const item = state.inventory.find((i) => i.id === el.dataset.id);
    const hero = state.heroes[Number(el.dataset.hero)];
    if (item && hero) equip(state, hero, item);
    refresh();
    nextReveal();
  },
  revealNext: () => nextReveal(),
  sfx: (el) => {
    state.settings.sfx = el.checked;
    setSfx(el.checked);
    changed = true;
  },
  toggleAutoUlt: (el) => {
    game.setAutoUltimate(el.checked);
    changed = true;
  },
  pickHero: (el) => {
    ui.hero = Number(el.dataset.index);
    renderTeam(state);
  },
  classSheet: () => openSheet(() => classSheet(state)),
  setClass: (el) => {
    const hero = state.heroes[ui.hero];
    if (!isClassUnlocked(state, el.dataset.class)) return;
    hero.classId = el.dataset.class;
    refresh();
  },
  setSpec: (el) => {
    const hero = state.heroes[ui.hero];
    if (hero.level < SPEC_LEVEL) return;
    hero.specs = { ...(hero.specs || {}), [hero.classId]: Number(el.dataset.spec) };
    refresh();
  },
  salvageItem: (el) => {
    const item = state.inventory.find((i) => i.id === el.dataset.id);
    if (item && salvageItem(state, item)) {
      questProgress(state, "salvage", 1);
      refresh();
    }
  },
  salvageAll: () => {
    const list = state.inventory.filter((i) => !i.locked);
    list.forEach((i) => salvageItem(state, i));
    questProgress(state, "salvage", list.length);
    refresh();
  },
  craftSet: (el) => {
    ui.craftSet = el.dataset.set;
    renderBag(state);
  },
  craftSlot: (el) => {
    ui.craftSlot = el.dataset.slot;
    renderBag(state);
  },
  craft: () => {
    const item = craftSetPiece(state, ui.craftSet, ui.craftSlot);
    if (item) {
      refresh();
      queueReveal(item);
    }
  },
  toggleMod: (el) => {
    const key = el.dataset.mod;
    const list = state.hunt ? state.hunt.mods : ui.huntMods;
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    if (state.hunt) state.hunt.mods = next;
    else ui.huntMods = next;
    changed = true;
    refreshSheet();
  },
  slotSheet: (el) => {
    const slot = el.dataset.slot;
    openSheet(() => slotSheet(state, slot));
  },
  itemSheet: (el) => {
    const id = el.dataset.id;
    ui.compareHero = null;
    openSheet(() => itemSheet(state, id));
    renderWallet();
    if (activeTab === "bag") renderBag(state);
  },
  compareHero: (el) => {
    ui.compareHero = Number(el.dataset.index);
    refreshSheet();
  },
  forge: (el) => {
    if (forgeItem(state, state.heroes[ui.hero].gear[el.dataset.slot])) {
      questProgress(state, "forge", 1);
      refresh();
    }
  },
  claimQuest: (el) => {
    const reward = claimQuest(state, Number(el.dataset.index));
    if (reward) {
      sfx("loot");
      toast(t("quest.claimed", { shards: reward.shards, gold: fmt(reward.gold) }));
      refresh();
    }
  },
  transcend: () => {
    ui.confirmTranscend = true;
    renderAwaken(state);
  },
  transcendCancel: () => {
    ui.confirmTranscend = false;
    renderAwaken(state);
  },
  transcendConfirm: () => {
    ui.confirmTranscend = false;
    const stars = transcend(state);
    if (stars) {
      game.restart();
      log(t("trans.done", { n: stars }), "boss");
      toast(t("trans.done", { n: stars }));
      sfx("legendary");
      refresh();
      save();
    }
  },
  reroll: (el) => {
    const result = rerollAffix(state, state.heroes[ui.hero].gear[el.dataset.slot]);
    if (result) refresh();
  },
  unequip: (el) => {
    if (unequip(state, state.heroes[ui.hero], el.dataset.slot)) refresh();
  },
  equipItem: (el) => {
    const item = state.inventory.find((i) => i.id === el.dataset.id);
    const hero = state.heroes[Number(el.dataset.hero)];
    if (item && hero) {
      equip(state, hero, item);
      refresh();
    }
  },
  sellItem: (el) => {
    const item = state.inventory.find((i) => i.id === el.dataset.id);
    if (item) {
      sellItem(state, item);
      refresh();
    }
  },
  lockItem: (el) => {
    const item = state.inventory.find((i) => i.id === el.dataset.id);
    if (item) {
      item.locked = !item.locked;
      refresh();
    }
  },
  sellAll: () => {
    state.inventory.filter((i) => !i.locked).forEach((i) => sellItem(state, i));
    refresh();
  },
  bagFilter: (el) => {
    ui.bagFilter = el.dataset.filter;
    renderBag(state);
  },
  toggleAutoSell: (el) => {
    const list = state.settings.autoSell;
    const key = el.dataset.rarity;
    state.settings.autoSell = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    changed = true;
    renderBag(state);
  },
  toggleAutoEquip: (el) => {
    state.settings.autoEquip = el.checked;
    changed = true;
  },
  zoneSheet: () => openSheet(() => zoneSheet(state)),
  startTrial: () => {
    startTrial(state);
    game.restart();
    closeSheet();
    showTab("combat");
    refresh();
  },
  leaveTrial: () => {
    endTrial(state);
    game.restart();
    refresh();
  },
  huntLevel: (el) => {
    ui.huntLevel = clampHuntLevel(state, (ui.huntLevel || 1) + Number(el.dataset.step));
    refreshSheet();
  },
  startHunt: (el) => {
    if (startHunt(state, el.dataset.boss, ui.huntLevel, ui.huntMods)) {
      game.restart();
      closeSheet();
      refresh();
    }
  },
  leaveHunt: () => {
    stopHunt(state);
    game.restart();
    closeSheet();
    refresh();
  },
  awaken: () => {
    ui.confirmAwaken = true;
    renderAwaken(state);
  },
  awakenCancel: () => {
    ui.confirmAwaken = false;
    renderAwaken(state);
  },
  awakenConfirm: () => {
    ui.confirmAwaken = false;
    const souls = awaken(state);
    if (souls) {
      game.restart();
      log(t("awaken.done", { n: fmt(souls) }), "boss");
      toast(t("awaken.done", { n: fmt(souls) }));
      changed = true;
      save();
    }
    renderAll();
  },
  buyUpgrade: (el) => {
    if (buyAwakening(state, el.dataset.key)) {
      changed = true;
      renderAll();
    }
  },
  settings: () => settingsSheet(),
  replayTutorial: () => {
    closeSheet();
    replayTutorial();
  },
  closeSheet: () => closeSheet(),
  lang: (el) => {
    state.settings.lang = el.dataset.lang;
    setLanguage(state.settings.lang);
    applyStaticTexts();
    if (game.battle) mountBattle(game.battle);
    renderAll();
    refreshSheet();
    changed = true;
  },
  music: (el) => {
    state.settings.music = el.checked;
    syncMusic();
    changed = true;
  },
  reset: () => {
    confirmReset = true;
    refreshSheet();
  },
  cancelReset: () => {
    confirmReset = false;
    refreshSheet();
  },
  resetConfirm: async () => {
    await storage.clear();
    const fresh = createState();
    fresh.settings.lang = state.settings.lang;
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, fresh);
    feed.length = 0;
    $("feed").innerHTML = "";
    game.restart();
    closeSheet();
    renderAll();
    log(t("feed.welcome"));
    save();
  },
};

/* ---------- Appui long : aperçu rapide d'un objet ---------- */
let pressTimer = null;
let suppressClick = false;

function showPeek(el) {
  const peek = $("peek");
  let html = "";
  if (el.dataset.id) {
    const item = state.inventory.find((i) => i.id === el.dataset.id);
    if (!item) return;
    html = `<b class="r-${item.rarity}">${esc(itemName(item))}</b><span class="muted">${t("peek.gain")}</span>` +
      state.heroes
        .map((h) => {
          const gain = gainFromItem(h, item, state);
          return `<span class="peek-row"><span>${esc(className(h.classId))}</span><b class="${gain > 0.001 ? "up" : gain < -0.001 ? "down" : ""}">${gain > 0 ? "+" : ""}${pct(gain)} %</b></span>`;
        })
        .join("");
  } else if (el.dataset.slot) {
    const item = state.heroes[ui.hero].gear[el.dataset.slot];
    if (!item) return;
    html = `<b class="r-${item.rarity}">${esc(itemName(item))}</b>${itemDetail(item, state.heroes[ui.hero]).replace(/<div class="item-title">[\s\S]*?<\/div>\s*<\/div>/, "")}`;
  }
  peek.innerHTML = html;
  peek.hidden = false;
  const r = el.getBoundingClientRect();
  const w = peek.offsetWidth;
  const h = peek.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  const top = r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8;
  peek.style.left = `${left}px`;
  peek.style.top = `${top}px`;
}

function hidePeek() {
  clearTimeout(pressTimer);
  $("peek").hidden = true;
}

function bindPeek() {
  document.addEventListener("pointerdown", (event) => {
    const el = event.target.closest?.(".tile[data-id], .doll-slot[data-slot]");
    if (!el) return;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      suppressClick = true;
      showPeek(el);
    }, 420);
  });
  ["pointerup", "pointercancel", "scroll"].forEach((type) => document.addEventListener(type, hidePeek, { passive: true }));
  // Pas de menu contextuel (appui long / clic droit), sauf dans les champs de saisie.
  document.addEventListener("contextmenu", (event) => {
    if (!event.target.closest?.("input, textarea")) event.preventDefault();
  });
  document.addEventListener("selectstart", (event) => {
    if (!event.target.closest?.("input, textarea")) event.preventDefault();
  });
  document.addEventListener("dragstart", (event) => event.preventDefault());
  // Après un appui long, le clic qui suit n'ouvre pas la fiche.
  document.addEventListener(
    "click",
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopImmediatePropagation();
      event.preventDefault();
    },
    true
  );
}

function bindUi() {
  bindPeek();
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) return showTab(nav.dataset.nav);
    if (event.target === $("sheet")) return closeSheet();
    if (event.target.closest("#settingsBtn")) return settingsSheet();
    const el = event.target.closest("[data-action]");
    if (!el || el.disabled || el.type === "checkbox") return;
    actions[el.dataset.action]?.(el);
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el.type === "checkbox" && el.dataset.action) actions[el.dataset.action]?.(el);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sheetOpen()) closeSheet();
    const el = event.target.closest?.('[role="button"][data-action]');
    if (el && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      actions[el.dataset.action]?.(el);
    }
  });
  document.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
      if (state.settings.music) syncMusic();
    },
    { once: true }
  );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
  });
  window.addEventListener("pagehide", () => save());
}

/* ---------- Boucle ---------- */
let renderClock = 0;
let tutoClock = 0;
function frame(now) {
  const gap = lastFrame ? now - lastFrame : 0;
  lastFrame = now;

  if (gap > 60000) {
    // L'onglet était en arrière-plan : gains hors-ligne plutôt que simulation.
    state.lastSeen = Date.now() - gap;
    showOffline(computeOffline(state));
    game.restart();
  } else if (!tutorialPaused()) {
    game.update(gap / 1000);
  }

  updateBattle(game);
  // Le tutoriel attend qu'aucune fiche ne soit ouverte : on revérifie chaque seconde.
  tutoClock += gap;
  if (tutoClock > 1000) {
    tutoClock = 0;
    checkTutorial();
  }
  renderClock += gap;
  if (dirty && renderClock > 250) {
    renderClock = 0;
    dirty = false;
    renderAll();
  }
  if (changed && now - lastSave > SAVE_EVERY) save();
  requestAnimationFrame(frame);
}

/* ---------- Installation (PWA) ---------- */
// Hors artefact uniquement : sur GitHub Pages, le jeu s'installe et marche hors connexion.
function registerServiceWorker() {
  try {
    if (!("serviceWorker" in navigator) || window.claude || window.top !== window) return;
    navigator.serviceWorker.register("sw.js").catch(() => {});
  } catch {
    /* navigateur sans service worker */
  }
}

/* ---------- Écran de démarrage ---------- */
// Logo Keismey Studio (2,3 s, un appui le passe), puis écran titre : un appui lance
// la partie et débloque l'audio (les navigateurs l'exigent).
function runSplash(skip) {
  const splash = $("splash");
  if (skip) {
    splash.remove();
    return;
  }
  $("splashTap").textContent = t(matchMedia("(hover: hover) and (pointer: fine)").matches ? "splash.click" : "splash.tap");
  const title = $("splashTitle");
  title.style.setProperty("--title-bg", assetUrl("assets/title-bg.webp"));
  title.style.setProperty("--title-fallback", bgUrl("campaign"));
  const logo = $("splashLogo");
  let step = 0;
  const toTitle = () => {
    if (step) return;
    step = 1;
    logo.classList.add("out");
    setTimeout(() => logo.remove(), 700);
  };
  const timer = setTimeout(toTitle, 2300);
  logo.addEventListener("click", () => {
    clearTimeout(timer);
    toTitle();
  });
  title.addEventListener("click", () => {
    if (step !== 1) return;
    step = 2;
    unlockAudio();
    syncMusic();
    splash.classList.add("closing");
    setTimeout(() => {
      splash.remove();
      checkTutorial();
    }, 650);
  });
}

/* ---------- Démarrage ---------- */
async function start(hot = {}) {
  registerServiceWorker();
  storage = await createStorage();
  const saved = hot.save || (await storage.load().catch(() => null));
  state = saved ? migrate(saved) : createState();
  setLanguage(state.settings.lang);
  setSfx(state.settings.sfx);
  applyStaticTexts();
  runSplash(Boolean(hot.save));

  game = createGame(state, { onEvent: onGameEvent });
  bindUi();
  initTutorial({
    state: () => state,
    game: () => game,
    activeTab: () => activeTab,
    showTab,
    changed: () => (changed = true),
  });
  renderAll();
  log(t("feed.welcome"));
  if (saved && !hot.save) showOffline(computeOffline(state));
  else if (!saved && hasLegacySave()) welcomeVeteran();
  state.lastSeen = Date.now();
  window.claude?.hot?.snapshot?.(() => ({ save: snapshot() }));
  requestAnimationFrame(frame);
}

const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});

