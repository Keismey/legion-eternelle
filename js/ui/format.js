// Petits utilitaires d'affichage partagés par tous les écrans.
import { t, language } from "../data/i18n.js";
import { CLASSES } from "../data/classes.js";
import { EFFECTS } from "../data/effects.js";

const SUFFIXES = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

export function fmt(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs < 1000) return abs < 10 && abs % 1 ? n.toFixed(1).replace(".", language() === "fr" ? "," : ".") : String(Math.round(n));
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(abs) / 3));
  const scaled = n / Math.pow(1000, tier);
  const text = scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0);
  return (language() === "fr" ? text.replace(".", ",") : text) + SUFFIXES[tier];
}

export const pct = (x, digits = 0) => {
  const text = (x * 100).toFixed(digits);
  return language() === "fr" ? text.replace(".", ",") : text;
};

export function duration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, "0")}`;
  return `${Math.max(1, m)} min`;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Images (assets/) : la taille dépend du conteneur, voir style.css.
const img = (src, cls) => `<img class="${cls}" src="${src}" alt="" decoding="async" draggable="false">`;
export const SLOT_ICONS = Object.fromEntries(
  ["helmet", "gloves", "chest", "legs", "boots"].map((s) => [s, img(`assets/slots/${s}.webp`, "slot-img")])
);
export const MONSTER_ICONS = Object.fromEntries(
  ["goblin", "ghoul", "wolf", "bandit", "spider", "orc", "skeleton", "cultist", "slime", "harpy"].map((m) => [m, img(`assets/monsters/${m}.webp`, "monster-img")])
);
// Fond de décor pour une variable CSS. L'URL doit être absolue : une url() relative
// dans une variable se résout depuis css/style.css, pas depuis la page.
export function assetUrl(path) {
  try {
    return `url("${new URL(path, document.baseURI).href}")`;
  } catch {
    return `url("../${path}")`;
  }
}
export const bgUrl = (id) => assetUrl(`assets/bg/${id}.webp`);
export const bossArt = (id) => img(`assets/bosses/${id}.webp`, "boss-img");
// Créatures invoquées par les boss corrompus (pas d'image dédiée)
MONSTER_ICONS.treant = '<span class="monster-emoji">🌳</span>';
MONSTER_ICONS.shard = '<span class="monster-emoji">🪨</span>';
// Emblèmes des uniques ; un pouvoir sans image affiche ✦.
const UNIQUE_ART = new Set(["executioner", "phoenix", "retaliate", "aegis", "frenzy", "chain", "vampiric", "titan", "tempest", "inferno", "bastion", "reaper"]);
export const uniqueIcon = (id) =>
  UNIQUE_ART.has(id) ? img(`assets/uniques/${id}.webp`, "unique-img") : '<span class="unique-img unique-fallback">✦</span>';
export const currencyIcon = (id) => img(`assets/icons/${id}.webp`, "currency-img");

export function itemName(item) {
  let name;
  if (item.setId) name = t("item.setName", { slot: t(`slot.${item.slot}`), set: t(`setShort.${item.setId}`) });
  else if (item.unique) name = t("item.legendaryName", { slot: t(`slot.${item.slot}`), unique: t(`uniqueShort.${item.unique}`) });
  else name = t(`item.${item.slot}.${item.rarity}`);
  return name + (item.plus ? ` +${item.plus}` : "");
}

export function fxText(key, value) {
  const kind = EFFECTS[key]?.kind || "pct";
  return t(`fx.${key}`, { v: kind === "pct" ? pct(value) : "" });
}

export const fxList = (fx) => Object.entries(fx || {}).filter(([, v]) => v).map(([k, v]) => fxText(k, v));
export const className = (classId) => t(`class.${classId}`);
// Portrait de classe (image) ; la taille dépend du conteneur (voir .portrait en CSS).
export const classIcon = (classId) =>
  `<img class="portrait" src="assets/heroes/${classId}.webp" alt="" width="256" height="256" decoding="async" draggable="false">`;
export const classEmoji = (classId) => CLASSES[classId].icon;
export const heroName = (hero) => className(hero.classId);
