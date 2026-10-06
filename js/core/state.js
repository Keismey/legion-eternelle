// État de la partie : création, migration des sauvegardes.
import { SLOT_KEYS, AWAKENING } from "../data/config.js";
import { ROLE_KEYS, STARTER_CLASSES, CLASSES } from "../data/classes.js";
import { starterGear } from "./loot.js";
import { emptyCodex } from "./meta.js";

export const SAVE_VERSION = 2;

const emptyGear = () => Object.fromEntries(SLOT_KEYS.map((s) => [s, null]));

export function createHero(role, classId = STARTER_CLASSES[role], { gear = true } = {}) {
  return { role, classId, level: 1, xp: 0, specs: {}, gear: gear ? starterGear(1) : emptyGear() };
}

export function createState() {
  return {
    version: SAVE_VERSION,
    gold: 0,
    souls: 0,
    shards: 0,
    stars: 0,
    cycleSouls: 0,
    codex: emptyCodex(),
    quests: null,
    trial: null, // tour d'épreuves de la semaine
    trialBestEver: 0,
    achievements: [],
    totalSouls: 0,
    awakenings: 0,
    awakening: Object.fromEntries(Object.keys(AWAKENING).map((k) => [k, 0])),
    maxLevel: 1,
    bestLevel: 1,
    zone: { level: 1, wave: 0, autoAdvance: true },
    hunt: null, // { bossId, level, wave } quand l'équipe chasse un set
    heroes: ROLE_KEYS.map((role) => createHero(role)),
    inventory: [],
    bossesDefeated: [],
    settings: { lang: "fr", autoEquip: false, autoSell: [], autoUltimate: true, music: false, sfx: true },
    stats: { kills: 0, waves: 0, bossKills: 0, waveSeconds: 12 },
    lastSeen: Date.now(),
    tutorial: { intro: false, tips: [] }, // visite guidée faite, astuces déjà lues
  };
}

// Fusion défensive : une vieille sauvegarde ou un champ manquant
// ne doit jamais casser le jeu.
export function migrate(raw) {
  const fresh = createState();
  if (!raw || typeof raw !== "object") return fresh;
  const state = { ...fresh, ...raw };
  state.zone = { ...fresh.zone, ...(raw.zone || {}) };
  state.settings = { ...fresh.settings, ...(raw.settings || {}) };
  state.stats = { ...fresh.stats, ...(raw.stats || {}) };
  state.awakening = { ...fresh.awakening, ...(raw.awakening || {}) };
  state.codex = { ...fresh.codex, ...(raw.codex || {}) };
  state.heroes = ROLE_KEYS.map((role) => {
    const saved = (raw.heroes || []).find((h) => h.role === role);
    if (!saved || !CLASSES[saved.classId]) return createHero(role);
    return { ...createHero(role, saved.classId, { gear: false }), ...saved, gear: { ...emptyGear(), ...(saved.gear || {}) } };
  });
  state.inventory = Array.isArray(raw.inventory) ? raw.inventory.map(upgradeItem) : [];
  for (const hero of state.heroes) for (const slot of SLOT_KEYS) if (hero.gear[slot]) hero.gear[slot] = upgradeItem(hero.gear[slot]);
  if ((raw.version || 1) < 2) state.settings.autoEquip = false; // la v2 rend la main au joueur
  if (state.hunt && !state.bossesDefeated.includes(state.hunt.bossId)) state.hunt = null;
  state.bossesDefeated = Array.isArray(raw.bossesDefeated) ? raw.bossesDefeated : [];
  state.achievements = Array.isArray(raw.achievements) ? raw.achievements : [];
  // Une partie déjà entamée avant le tutoriel ne le subit pas (il reste dans les réglages).
  if (!raw.tutorial || typeof raw.tutorial !== "object") {
    const started = (raw.bestLevel || 1) > 3 || (raw.awakenings || 0) > 0;
    state.tutorial = started ? { intro: true, tips: ["loot", "boss", "wall", "unlock", "lair", "trial", "awakenReady", "spec", "corrupt"] } : { intro: false, tips: [] };
  } else state.tutorial = { intro: Boolean(raw.tutorial.intro), tips: Array.isArray(raw.tutorial.tips) ? raw.tutorial.tips : [] };
  delete state.tutorialDone;
  delete state.settings.speed; // réglage du labo de test, retiré
  state.version = SAVE_VERSION;
  return state;
}

// Objets d'une version précédente : on complète les nouveaux champs.
function upgradeItem(item) {
  return { focus: "balanced", unique: null, classAffix: null, setId: null, isNew: false, affixes: {}, ...item };
}

export function isClassUnlocked(state, classId) {
  const unlock = CLASSES[classId].unlock;
  if (!unlock) return true;
  if (unlock.boss) return state.bossesDefeated.includes(unlock.boss);
  if (unlock.awakenings) return state.awakenings >= unlock.awakenings;
  return false;
}
