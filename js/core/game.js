// Boucle de jeu : enchaîne les vagues, distribue les récompenses,
// gère la progression de zone, l'Éveil et les gains hors-ligne.
import { BALANCE as B, AWAKENING } from "../data/config.js";
import { CLASS_KEYS } from "../data/classes.js";
import { createBattle, step, castUltimate } from "./combat.js";
import { activeZone, huntModifiers } from "./zones.js";
import { questProgress, refreshQuests, noteItem, noteSets, soulBonus, pendingStars } from "./meta.js";
import { trialRules, endTrial, floorShards, TRIAL } from "./challenges.js";
import { xpPerMonster, xpToNext, goldPerMonster, soulsForLevel } from "./curve.js";
import { createItem, receiveItem, lootLuck, starterGear } from "./loot.js";
import { computeHero, heroEffects, teamStrength, awakeningBonus } from "./heroes.js";
import { createState, isClassUnlocked } from "./state.js";

const STEP = 0.1;
const BETWEEN_WAVES = 0.7;

export function goldMultiplier(state) {
  const fortune = state.heroes.reduce((t, h) => t + computeHero(h, state).fortune, 0);
  return (1 + fortune) * (1 + awakeningBonus(state, "greed"));
}

export function lootMultiplier(state) {
  return 1 + state.heroes.reduce((t, h) => t + (heroEffects(h).fx.loot || 0), 0);
}

export const autoUltimateUnlocked = (state) => (state.awakening.instinct || 0) > 0;

export function grantXp(state, amount) {
  const leveled = [];
  const cap = state.maxLevel + B.heroLevelCap;
  for (const hero of state.heroes) {
    if (hero.level >= cap) {
      hero.xp = Math.min(hero.xp + amount, xpToNext(hero.level) - 1);
      continue;
    }
    hero.xp += amount;
    while (hero.level < cap && hero.xp >= xpToNext(hero.level)) {
      hero.xp -= xpToNext(hero.level);
      hero.level++;
      leveled.push(hero);
    }
  }
  return leveled;
}

export function awakeningCost(state, key) {
  const a = AWAKENING[key];
  return Math.round(a.cost * Math.pow(a.costGrowth, state.awakening[key] || 0));
}

export function canBuyAwakening(state, key) {
  const a = AWAKENING[key];
  if (a.max && state.awakening[key] >= a.max) return false;
  return state.souls >= awakeningCost(state, key);
}

export function buyAwakening(state, key) {
  if (!canBuyAwakening(state, key)) return false;
  state.souls -= awakeningCost(state, key);
  state.awakening[key]++;
  return true;
}

export function pendingSouls(state) {
  return Math.floor(soulsForLevel(state.maxLevel) * soulBonus(state));
}

export function awaken(state) {
  const souls = pendingSouls(state);
  if (souls <= 0) return false;
  state.souls += souls;
  state.totalSouls += souls;
  state.cycleSouls = (state.cycleSouls || 0) + souls;
  state.awakenings++;
  resetRun(state, Math.max(1, Math.floor(state.bestLevel * awakeningBonus(state, "momentum"))));
  return souls;
}

// Transcendance : sacrifie âmes et bonus d'Éveil contre des étoiles permanentes.
export const starsAvailable = (state) => pendingStars(state, pendingSouls(state));

export function transcend(state) {
  const stars = starsAvailable(state);
  if (stars <= 0) return false;
  state.stars = (state.stars || 0) + stars;
  state.souls = 0;
  state.cycleSouls = 0;
  for (const key of Object.keys(state.awakening)) if (key !== "instinct") state.awakening[key] = 0;
  resetRun(state, 1);
  return stars;
}

function resetRun(state, startLevel) {
  const fresh = createState();
  state.gold = 0;
  state.inventory = state.inventory.filter((i) => i.locked);
  state.zone = { ...fresh.zone, level: startLevel };
  state.hunt = null;
  state.maxLevel = startLevel;
  state.heroes = state.heroes.map((h) => {
    return { ...h, level: startLevel, xp: 0, gear: starterGear(startLevel) };
  });
}

export function computeOffline(state, now = Date.now()) {
  // La tour d'épreuves ne se joue pas hors-ligne : on la clôt au retour.
  if (state.trial?.active) endTrial(state);
  const seconds = Math.min((now - (state.lastSeen || now)) / 1000, B.offlineCapHours * 3600);
  if (seconds < 60) return null;
  const zone = activeZone(state);
  const level = zone.level;
  const waves = Math.floor((seconds / Math.max(4, state.stats.waveSeconds)) * B.offlineEfficiency);
  if (waves <= 0) return null;
  const monsters = waves * 1.7;
  const gold = Math.round(goldPerMonster(level) * monsters * goldMultiplier(state));
  const xp = xpPerMonster(level) * monsters * (1 + awakeningBonus(state, "wisdom"));
  state.gold += gold;
  const leveled = grantXp(state, xp);
  const hunting = zone.kind === "hunt";
  const itemCount = Math.min(15, Math.round(waves * B.lootChance * lootMultiplier(state) * (hunting ? B.huntLootFactor : 1)));
  const setCount = hunting ? Math.min(5, Math.round(waves * (B.huntSetChance + 0.1 / B.wavesPerLevel))) : 0;
  let equipped = 0;
  const drops = [
    ...Array.from({ length: itemCount }, () => createItem(level, { luck: lootLuck(state) })),
    ...Array.from({ length: setCount }, () => createItem(level, { setId: zone.boss.id })),
  ];
  for (const item of drops) {
    noteItem(state, item);
    const result = receiveItem(state, item);
    if (result.outcome === "equipped") equipped++;
  }
  return { seconds, waves, gold, xp, levels: leveled.length ? state.heroes[0].level : 0, items: drops.length, sets: setCount, equipped };
}

export function createGame(state, { onEvent = () => {}, rng = Math.random } = {}) {
  const game = {
    state,
    battle: null,
    phase: "between", // fighting | between | respawn
    timer: 0.3,
    accumulator: 0,
    // Jauges d'ultime gardées entre les vagues : on peut les garder pour le boss.
    charges: state.heroes.map(() => 0),
  };

  const bump = (key, n = 1) => (state.stats[key] = (state.stats[key] || 0) + n);
  const emit = (type, data = {}) => {
    if (type === "ultimate") {
      questProgress(state, "ultimates", 1);
      bump("ultimates");
    }
    if (type === "combo") bump("combos");
    onEvent(type, data, game);
  };

  function startWave() {
    game.battle = createBattle(state, {
      rng,
      autoUltimate: autoUltimateUnlocked(state) && state.settings.autoUltimate,
      modifiers: state.hunt ? huntModifiers(state) : null,
      rules: state.trial?.active ? trialRules(state) : null,
      charges: game.charges,
    });
    game.phase = "fighting";
    emit("wave", { battle: game.battle });
  }

  function unlockedClasses() {
    return CLASS_KEYS.filter((id) => isClassUnlocked(state, id));
  }

  function rollDrops(zone, isBoss, hasElite) {
    const luck = lootLuck(state);
    const drops = [];
    if (hasElite) drops.push(createItem(zone.level, { luck, minRank: 1, rng }));
    if (isBoss && zone.corrupted) drops.push(createItem(zone.level + 1, { luck, minRank: 2, rng }));
    if (zone.kind === "hunt") {
      const mods = huntModifiers(state);
      const lootBoost = 1 + mods.loot;
      if (isBoss) {
        drops.push(createItem(zone.level + 1, { setId: zone.boss.id, rng }));
        if (rng() < 0.3 + mods.setChance) drops.push(createItem(zone.level + 1, { setId: zone.boss.id, rng }));
      } else if (rng() < B.huntSetChance * lootBoost) drops.push(createItem(zone.level, { setId: zone.boss.id, rng }));
      else if (rng() < B.lootChance * B.huntLootFactor * lootMultiplier(state) * lootBoost) drops.push(createItem(zone.level, { luck, rng }));
      return drops;
    }
    if (isBoss) {
      const level = zone.level + B.bossLootLevelBonus;
      drops.push(createItem(level, { luck, minRank: 1, rng }));
      if (rng() < 0.5) drops.push(createItem(level, { luck, rng }));
    } else if (rng() < B.lootChance * lootMultiplier(state)) {
      drops.push(createItem(zone.level, { luck, rng }));
    }
    return drops;
  }

  // Tour d'épreuves : pas d'or ni d'XP, des éclats par étage et un légendaire tous les 5.
  function onTrialVictory(battle) {
    const trial = state.trial;
    const floor = trial.floor;
    // Récompenses une seule fois par étage et par semaine : relancer la tour ne rapporte rien de plus.
    const firstClear = floor > trial.best;
    const shards = firstClear ? floorShards(floor) : 0;
    state.shards = (state.shards || 0) + shards;
    state.stats.kills += battle.monsters.length;
    trial.best = Math.max(trial.best, floor);
    state.trialBestEver = Math.max(state.trialBestEver || 0, floor);
    const loot = [];
    if (firstClear && floor % TRIAL.bossEvery === 0) {
      const item = createItem(state.maxLevel, { rarity: "legendary", rng });
      const entry = noteItem(state, item);
      bump("legendaries");
      loot.push({ item, ...receiveItem(state, item) });
      if (entry) emit("codexEntry", entry);
    }
    trial.floor++;
    emit("trialFloor", { floor, shards, loot });
  }

  function onVictory(battle) {
    if (state.trial?.active) return onTrialVictory(battle);
    const zone = activeZone(state);
    const count = battle.monsters.length;
    const isBoss = Boolean(battle.boss);
    const rewardUnits = isBoss ? B.bossGoldMultiplier : count;

    const gold = Math.round(goldPerMonster(zone.level) * rewardUnits * goldMultiplier(state));
    state.gold += gold;
    const xp = xpPerMonster(zone.level) * rewardUnits * (1 + awakeningBonus(state, "wisdom"));
    const leveled = grantXp(state, xp);

    state.stats.kills += count;
    state.stats.waves++;
    state.stats.waveSeconds = state.stats.waveSeconds * 0.85 + (battle.elapsed + BETWEEN_WAVES) * 0.15;

    const elites = battle.monsters.filter((m) => m.elite).length;
    const codex = [];
    if (elites) bump("elites", elites);
    const loot = rollDrops(zone, isBoss, elites > 0).map((item) => {
      if (item.rarity === "legendary") bump("legendaries");
      const entry = noteItem(state, item);
      if (entry) codex.push(entry);
      return { item, ...receiveItem(state, item) };
    });
    codex.push(...noteSets(state));

    refreshQuests(state);
    questProgress(state, "kills", count);
    if (elites) questProgress(state, "elites", elites);
    if (isBoss) questProgress(state, zone.kind === "hunt" ? "lairBoss" : "campaignBoss", 1);

    let unlocked = [];
    let lairUnlocked = null;
    if (isBoss) {
      state.stats.bossKills++;
      if (zone.corrupted) state.stats.corruptedKills = (state.stats.corruptedKills || 0) + 1;
      const before = new Set(unlockedClasses());
      if (!state.bossesDefeated.includes(battle.boss.id)) {
        state.bossesDefeated.push(battle.boss.id);
        lairUnlocked = battle.boss.id;
      }
      unlocked = unlockedClasses().filter((id) => !before.has(id));
    }

    let levelUp = false;
    if (zone.kind === "hunt") {
      state.hunt.wave = (state.hunt.wave + 1) % B.wavesPerLevel;
    } else {
      const z = state.zone;
      if (z.autoAdvance) {
        z.wave++;
        if (z.wave >= B.wavesPerLevel) {
          z.wave = 0;
          z.level++;
          levelUp = true;
          state.maxLevel = Math.max(state.maxLevel, z.level);
          state.bestLevel = Math.max(state.bestLevel, z.level);
        }
      } else {
        z.wave = Math.min(z.wave + 1, B.wavesPerLevel - 1);
        // Relance automatique quand l'équipe a progressé depuis l'échec
        if (z.failStrength && teamStrength(state) > z.failStrength * 1.08) {
          z.autoAdvance = true;
          z.failStrength = null;
          emit("autoPush");
        }
      }
    }

    if (lairUnlocked) codex.push({ kind: "boss", id: lairUnlocked });
    emit("victory", { gold, xp, leveled, loot, isBoss, boss: battle.boss, levelUp, unlocked, lairUnlocked, codex });
  }

  function onDefeat(battle, result) {
    if (state.trial?.active) {
      const floor = state.trial.floor;
      endTrial(state);
      emit("trialEnd", { floor, best: state.trial.best });
      return;
    }
    if (state.hunt) {
      state.hunt.wave = 0;
      emit("defeat", { result, boss: battle.boss, hunt: true });
      return;
    }
    const zone = state.zone;
    zone.failStrength = teamStrength(state);
    zone.autoAdvance = false;
    if (battle.boss) zone.wave = B.wavesPerLevel - 1;
    else {
      zone.level = Math.max(1, zone.level - 1);
      zone.wave = 0;
    }
    emit("defeat", { result, boss: battle.boss });
  }

  game.update = (realDt) => {
    const dt = Math.min(realDt, 1);
    game.accumulator += dt;
    while (game.accumulator >= STEP) {
      game.accumulator -= STEP;
      tick(STEP);
    }
  };

  function tick(dt) {
    if (game.phase === "fighting") {
      step(game.battle, dt, emit);
      if (game.battle.over === "win") {
        game.charges = game.battle.heroes.map((h) => h.charge);
        onVictory(game.battle);
        game.phase = "between";
        game.timer = BETWEEN_WAVES;
      } else if (game.battle.over) {
        game.charges = game.charges.map(() => 0); // une défaite vide les jauges
        onDefeat(game.battle, game.battle.over);
        game.phase = "respawn";
        game.timer = B.respawnDelay;
      }
    } else {
      game.timer -= dt;
      if (game.timer <= 0) startWave();
    }
  }

  game.challenge = () => {
    state.zone.autoAdvance = true;
    state.zone.failStrength = null;
    if (game.phase !== "fighting") game.timer = Math.min(game.timer, 0.3);
    emit("state");
  };

  game.farm = () => {
    state.zone.autoAdvance = false;
    emit("state");
  };

  game.ultimate = (index) => {
    if (game.phase !== "fighting") return false;
    return castUltimate(game.battle, index, emit);
  };

  game.setAutoUltimate = (on) => {
    state.settings.autoUltimate = on;
    if (game.battle) game.battle.autoUltimate = autoUltimateUnlocked(state) && on;
  };

  game.restart = () => {
    game.battle = null;
    game.phase = "between";
    game.timer = 0.5;
  };

  return game;
}
