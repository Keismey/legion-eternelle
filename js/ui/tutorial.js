// Tutoriel : une visite guidée au premier lancement, puis des astuces ponctuelles
// qui apparaissent une seule fois, au moment où la mécanique devient utile.
// Textes : tuto.<id>.title / tuto.<id>.text (i18n).
import { t } from "../data/i18n.js";
import { SPEC_LEVEL } from "../data/specs.js";
import { gainFromItem } from "../core/heroes.js";
import { pendingSouls } from "../core/game.js";
import { sheetOpen } from "./sheet.js";

const $ = (id) => document.getElementById(id);

// Visite guidée : chaque étape éclaire un élément (target) ou s'affiche au centre.
export const INTRO = [
  { id: "welcome" },
  { id: "heroes", target: "#heroes" },
  { id: "zone", target: "#zone" },
  { id: "bag", target: '[data-nav="bag"]' },
  { id: "team", target: '[data-nav="team"]' },
  { id: "quests", target: "#quests" },
  { id: "awaken", target: '[data-nav="awaken"]' },
  { id: "end" },
];

// Astuces : when(state, game) → vrai quand l'astuce devient utile.
// tab : n'apparaît que sur cet onglet ; pause : fige le combat pendant la lecture.
export const TIPS = [
  { id: "loot", target: '[data-nav="bag"]', when: (s) => s.inventory.some((i) => s.heroes.some((h) => gainFromItem(h, i, s) > 0.001)) },
  { id: "boss", target: "#battlefield", tab: "combat", pause: true, when: (s, g) => Boolean(g?.battle?.boss) && !s.trial?.active },
  { id: "wall", target: "#zoneActions", when: (s) => !s.zone.autoAdvance && !s.hunt && !s.trial?.active },
  { id: "unlock", target: '[data-nav="team"]', when: (s) => s.bossesDefeated.length > 0 },
  { id: "lair", target: '[data-action="zoneSheet"]', when: (s) => s.bossesDefeated.length > 0 && !s.trial?.active },
  { id: "trial", target: '[data-nav="challenges"]', when: (s) => s.bestLevel >= 10 },
  { id: "awakenReady", target: '[data-nav="awaken"]', when: (s) => pendingSouls(s) > 0 },
  { id: "spec", target: '[data-nav="team"]', when: (s) => s.heroes.some((h) => h.level >= SPEC_LEVEL) },
  { id: "corrupt", target: "#battlefield", tab: "combat", pause: true, when: (s, g) => Boolean(g?.battle?.monsters?.some((m) => m.corruption)) },
];

let ctx = null; // { state(), game(), activeTab(), showTab(tab), changed() }
let current = null; // { kind: "intro" | "tip", steps, index }

export function initTutorial(context) {
  ctx = context;
  $("tuto").addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest("[data-tuto]");
    if (!button) return;
    if (button.dataset.tuto === "next") next();
    else finish();
  });
  window.addEventListener("resize", place);
  window.addEventListener("scroll", place, { passive: true });
}

export const tutorialActive = () => Boolean(current);
export const tutorialPaused = () => Boolean(current?.steps[current.index]?.pause);

// Quelque chose de plus important est à l'écran : on attend.
function busy() {
  return Boolean($("splash")) || sheetOpen() || !$("reveal").hidden;
}

// Appelé à chaque rendu : lance la visite si besoin, sinon la prochaine astuce.
export function checkTutorial() {
  if (!ctx || current || busy()) return;
  const state = ctx.state();
  state.tutorial ||= { intro: false, tips: [] };
  if (!state.tutorial.intro) return startIntro();
  for (const tip of TIPS) {
    if (state.tutorial.tips.includes(tip.id)) continue;
    if (tip.tab && ctx.activeTab() !== tip.tab) continue;
    if (!tip.when(state, ctx.game())) continue;
    current = { kind: "tip", steps: [tip], index: 0 };
    show();
    return;
  }
}

export function startIntro() {
  if (current) close();
  ctx.showTab("combat");
  current = { kind: "intro", steps: INTRO, index: 0 };
  show();
}

// Revoir le tutoriel (réglages) : visite + astuces remises à zéro.
export function replayTutorial() {
  ctx.state().tutorial = { intro: false, tips: [] };
  ctx.changed();
  startIntro();
}

function next() {
  if (current.index < current.steps.length - 1) {
    current.index += 1;
    show();
  } else finish();
}

// Fin de visite (ou « Passer ») ; une astuce lue est marquée vue.
function finish() {
  const state = ctx.state();
  if (current.kind === "intro") {
    state.tutorial.intro = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  else for (const s of current.steps) if (!state.tutorial.tips.includes(s.id)) state.tutorial.tips.push(s.id);
  ctx.changed();
  close();
  setTimeout(checkTutorial, 400);
}

function close() {
  current = null;
  $("tuto").hidden = true;
}

function targetOf(step) {
  if (!step.target) return null;
  const el = document.querySelector(step.target);
  if (!el || el.hidden || !el.getClientRects().length) return null;
  return el;
}

function show() {
  const step = current.steps[current.index];
  const intro = current.kind === "intro";
  const last = current.index === current.steps.length - 1;
  const dots = intro
    ? `<div class="tuto-dots" aria-hidden="true">${current.steps.map((_, i) => `<i class="${i === current.index ? "on" : ""}"></i>`).join("")}</div>`
    : `<span class="tuto-kicker">${t("tuto.tip")}</span>`;
  const actions = intro
    ? `${last ? "" : `<button class="btn ghost small" data-tuto="skip">${t("tuto.skip")}</button>`}<button class="btn primary small" data-tuto="next">${t(last ? "tuto.go" : "tuto.next")}</button>`
    : `<button class="btn primary small" data-tuto="next">${t("tuto.ok")}</button>`;
  $("tutoCard").innerHTML = `
    ${dots}
    <h3>${t(`tuto.${step.id}.title`)}</h3>
    <p>${t(`tuto.${step.id}.text`)}</p>
    <div class="tuto-actions">${actions}</div>`;
  $("tuto").hidden = false;
  const el = targetOf(step);
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center" });
  }
  place();
  $("tutoCard").querySelector('[data-tuto="next"]')?.focus({ preventScroll: true });
}

// Place l'anneau sur la cible et la bulle au-dessus ou en dessous.
function place() {
  if (!current) return;
  const ring = $("tutoRing");
  const card = $("tutoCard");
  const el = targetOf(current.steps[current.index]);
  $("tuto").classList.toggle("center", !el);
  if (!el) {
    ring.hidden = true;
    card.style.top = "";
    return;
  }
  const pad = 6;
  const r = el.getBoundingClientRect();
  ring.hidden = false;
  Object.assign(ring.style, {
    left: `${r.left - pad}px`,
    top: `${r.top - pad}px`,
    width: `${r.width + pad * 2}px`,
    height: `${r.height + pad * 2}px`,
  });
  const h = card.offsetHeight;
  const below = r.bottom + pad + 12;
  const above = r.top - pad - 12 - h;
  const top = below + h < window.innerHeight - 8 ? below : above > 8 ? above : Math.max(8, (window.innerHeight - h) / 2);
  card.style.top = `${top}px`;
}
