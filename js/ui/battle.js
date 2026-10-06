// Affichage du combat : cartes des unités, barres de vie, chiffres flottants.
import { t } from "../data/i18n.js";
import { fmt, esc, MONSTER_ICONS, classIcon, className, bossArt, bgUrl } from "./format.js";
import { sfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);
let refs = { monsters: [], heroes: [] };
let current = null;
let flash = { text: "", until: 0 };

export function flashStatus(text, ms = 1400) {
  flash = { text, until: performance.now() + ms };
}

function unitCard({ icon, name, sub, enemy, boss, hero, elite }) {
  const el = document.createElement("div");
  el.className = `unit${boss ? " boss" : ""}${hero ? " hero" : ""}${elite ? " elite" : ""}`;
  el.innerHTML = `
    <div class="unit-icon" aria-hidden="true">${icon}</div>
    <div class="unit-name">${esc(name)}</div>
    ${sub ? `<div class="unit-sub">${esc(sub)}</div>` : ""}
    <div class="bar${enemy ? " enemy" : ""}"><i></i><i class="shield" style="width:0"></i></div>
    ${hero ? '<div class="bar ult"><i style="width:0"></i></div>' : ""}`;
  return {
    el,
    bar: el.querySelector(".bar"),
    fill: el.querySelector(".bar > i"),
    shield: el.querySelector(".shield"),
    ult: el.querySelector(".bar.ult > i"),
    floats: 0,
    ready: false,
  };
}

export function mountBattle(battle) {
  current = battle;
  const monsters = $("monsters");
  const heroes = $("heroes");
  monsters.replaceChildren();
  heroes.replaceChildren();
  monsters.style.setProperty("--count", battle.monsters.length);
  $("battlefield").style.setProperty("--bg", bgUrl(battle.place || "campaign"));

  refs.monsters = battle.monsters.map((m) => {
    const card = unitCard({
      icon: m.boss ? bossArt(m.key) : MONSTER_ICONS[m.key] || "👾",
      name: m.boss ? (m.corruption ? t("boss.corrupted", { boss: t(`boss.${m.key}`) }) : t(`boss.${m.key}`)) : `${m.elite ? "⭐ " : ""}${t(`monster.${m.key}`)}`,
      sub: m.corruption ? t(`corrupt.${m.corruption.type}`) : m.elite ? t(`elite.${m.elite}`) : t("team.level", { n: battle.level }),
      enemy: true,
      boss: Boolean(m.boss),
      elite: Boolean(m.elite),
    });
    if (m.corruption) card.el.classList.add("corrupted");
    monsters.append(card.el);
    return card;
  });
  refs.heroes = battle.heroes.map((h, i) => {
    const card = unitCard({ icon: classIcon(h.ref.classId), name: className(h.ref.classId), sub: t("team.level", { n: h.ref.level }), hero: true });
    card.el.dataset.action = "ult";
    card.el.dataset.index = i;
    card.el.tabIndex = 0;
    card.el.setAttribute("role", "button");
    card.el.setAttribute("aria-label", `${className(h.ref.classId)} · ${t("ult.title")}`);
    heroes.append(card.el);
    return card;
  });

  $("bossBar").hidden = !battle.boss;
  if (battle.boss) {
    const corrupted = battle.monsters[0].corruption;
    $("bossName").textContent = corrupted ? t("boss.corrupted", { boss: t(`boss.${battle.boss.id}`) }) : t(`boss.${battle.boss.id}`);
    $("bossBar").classList.toggle("corrupted", Boolean(corrupted));
  }
  updateBattle({ battle, phase: "fighting" });
}

export function updateBattle(game) {
  const battle = game.battle;
  if (!battle) return;
  if (battle !== current || battle.monsters.length !== refs.monsters.length) mountBattle(battle);
  battle.monsters.forEach((m, i) => {
    const r = refs.monsters[i];
    if (!r) return;
    r.fill.style.width = `${(m.hp / m.maxHp) * 100}%`;
    r.shield.style.width = `${Math.min(100, (m.shield / m.maxHp) * 100)}%`;
    r.el.classList.toggle("dead", !m.alive);
  });
  battle.heroes.forEach((h, i) => {
    const r = refs.heroes[i];
    if (!r) return;
    const ratio = h.hp / h.maxHp;
    r.fill.style.width = `${ratio * 100}%`;
    r.bar.classList.toggle("hurt", ratio < 0.35);
    r.el.classList.toggle("dead", !h.alive);
    r.ult.style.width = `${h.charge}%`;
    const ready = h.alive && h.charge >= 100 && !battle.over;
    if (ready !== r.ready) {
      r.ready = ready;
      r.el.classList.toggle("ready", ready);
    }
  });

  const timer = $("bossTimer");
  if (battle.boss) {
    const left = Math.max(0, battle.bossTimer - battle.elapsed);
    timer.textContent = t("battle.timer", { s: Math.ceil(left) });
    timer.classList.toggle("low", left < 10);
    const boss = battle.monsters[0];
    const skill = $("bossSkill");
    // Menace la plus proche : la capacité du boss, ou sa nova s'il est corrompu
    const nova = boss.corruption?.type === "nova" && boss.corruptTimer < boss.skillTimer;
    const threat = nova ? boss.corruptTimer : boss.skillTimer;
    const name = nova ? t("corrupt.nova.name") : t(`skill.${battle.boss.id}`);
    const text = boss.alive ? t("boss.skillIn", { skill: name, s: Math.ceil(threat) }) : "";
    if (skill.textContent !== text) skill.textContent = text;
    skill.classList.toggle("soon", threat < 2.2);
  }

  const status = $("battleStatus");
  const text = performance.now() < flash.until ? flash.text : game.phase === "respawn" ? t("battle.respawn") : game.phase === "between" ? t("battle.next") : "";
  if (status.textContent !== text) status.textContent = text;
}

function spawnFloat(card, text, kind) {
  if (!card || card.floats >= 3 || document.hidden) return;
  card.floats++;
  const el = document.createElement("span");
  el.className = `float ${kind}`;
  el.textContent = text;
  card.el.append(el);
  setTimeout(() => {
    el.remove();
    card.floats--;
  }, 900);
}

export function battleEvent(type, data) {
  if (type === "hit") {
    const list = data.side === "monster" ? refs.monsters : refs.heroes;
    const card = list[data.index];
    if (!card) return;
    if (data.side === "monster") {
      spawnFloat(card, fmt(data.amount), data.crit ? "crit" : "dmg");
      sfx(data.crit ? "crit" : "hit");
    } else {
      sfx("hurt");
      spawnFloat(card, `-${fmt(data.amount)}`, "taken");
      card.el.classList.remove("hit");
      void card.el.offsetWidth;
      card.el.classList.add("hit");
    }
  } else if (type === "heal") {
    spawnFloat(refs.heroes[data.index], `+${fmt(data.amount)}`, "heal");
  } else if (type === "block") {
    spawnFloat(refs.heroes[data.index], t("battle.blocked"), "heal");
  } else if (type === "revive") {
    spawnFloat(refs.heroes[data.index], t("battle.revived"), "crit");
  } else if (type === "phase") {
    refs.monsters[0]?.el.classList.add("phase2");
    flashStatus(`🔥 ${t(`phase.${data.bossId}`)}`, 2200);
    document.getElementById("battlefield").classList.remove("shake");
    void document.getElementById("battlefield").offsetWidth;
    document.getElementById("battlefield").classList.add("shake");
    sfx("phase");
  } else if (["summon", "drain", "bleed", "nova", "reflect"].includes(type)) {
    flashStatus(`☠ ${t(`corrupt.${type}.flash`)}`, 1600);
    if (type === "nova") {
      document.getElementById("battlefield").classList.remove("shake");
      void document.getElementById("battlefield").offsetWidth;
      document.getElementById("battlefield").classList.add("shake");
      sfx("phase");
    }
  } else if (type === "combo") {
    spawnFloat(refs.heroes[data.index], t("battle.combo"), "crit");
    sfx("combo");
  } else if (type === "ultimate") {
    sfx("ultimate");
    const card = refs.heroes[data.index];
    if (card) {
      card.el.classList.remove("casting");
      void card.el.offsetWidth;
      card.el.classList.add("casting");
    }
    flashStatus(`✦ ${t(`ult.${data.id}`)}`);
  }
}
