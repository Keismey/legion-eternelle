// Écrans hors combat : bannière de zone, équipe, sac, Éveil, et leurs fiches.
// Chaque fonction renvoie ou remplace du HTML ; les clics passent par data-action.
import { BALANCE as B, HP_PER_POINT, SLOT_KEYS, AWAKENING, RARITIES, UNIQUES, CRAFT, MODIFIERS } from "../data/config.js";
import { SPECS, SPEC_LEVEL } from "../data/specs.js";
import { CLASSES, CLASS_KEYS } from "../data/classes.js";
import { BOSSES, SETS } from "../data/bosses.js";
import { t } from "../data/i18n.js";
import { computeHero, itemStat, teamStrength, gainFromItem } from "../core/heroes.js";
import { damageReduction, forgeCost, sellValue, xpToNext } from "../core/curve.js";
import { canForge, canReroll, rerollCost, salvageValue, canCraft } from "../core/loot.js";
import { isClassUnlocked } from "../core/state.js";
import { pendingSouls, awakeningCost, starsAvailable } from "../core/game.js";
import { QUEST_TYPES, questReward, codexCount, codexTotal, codexBonus, TRANSCEND, starBonus, soulBonus } from "../core/meta.js";
import { ULTIMATES } from "../core/combat.js";
import { activeZone, lairUnlocked } from "../core/zones.js";
import { ACHIEVEMENTS, TRIAL_RULES, TRIAL, floorLevel, floorShards } from "../core/challenges.js";
import { fmt, pct, esc, SLOT_ICONS, itemName, className, classIcon, fxText, fxList, uniqueIcon, currencyIcon, bossArt, bgUrl } from "./format.js";

const $ = (id) => document.getElementById(id);
export const ui = { hero: 0, confirmAwaken: false, confirmTranscend: false, bagFilter: "all", compareHero: null, huntLevel: null, huntMods: [], craftSet: null, craftSlot: "helmet" };

/* ---------- Bannière de zone ---------- */
function renderTrialZone(state, zone) {
  const mode = $("zoneMode");
  mode.textContent = t("trial.title");
  mode.classList.add("farm");
  $("zoneLevel").textContent = t("trial.floor", { n: zone.floor });
  $("zoneBest").textContent = t("trial.bestWeek", { n: state.trial.best });
  $("teamPower").textContent = fmt(teamStrength(state));
  const inCycle = (zone.floor - 1) % TRIAL.bossEvery;
  $("waves").innerHTML = Array.from({ length: TRIAL.bossEvery }, (_, i) => {
    const cls = ["wave-pip"];
    if (i < inCycle) cls.push("done");
    if (i === inCycle) cls.push("current");
    if (i === TRIAL.bossEvery - 1) cls.push("boss");
    return `<span class="${cls.join(" ")}"></span>`;
  }).join("");
  $("waves").style.gridTemplateColumns = `repeat(${TRIAL.bossEvery}, 1fr)`;
  const rules = state.trial.rules.map((r) => t(`rule.${r}`)).join(" · ");
  $("zoneActions").innerHTML = `<span class="hint">${t("trial.rules")} : ${rules}</span><button class="btn ghost small" data-action="leaveTrial">${t("trial.leave")}</button>`;
}

export function renderZone(state) {
  const zone = activeZone(state);
  if (zone.kind === "trial") return renderTrialZone(state, zone);
  $("waves").style.gridTemplateColumns = "";
  const hunting = zone.kind === "hunt";
  const farming = !hunting && !state.zone.autoAdvance;
  const mode = $("zoneMode");
  mode.textContent = hunting ? t("place.lair", { boss: t(`boss.${zone.boss.id}`) }) : farming ? t("zone.mode.farm") : t("zone.mode.advance");
  mode.classList.toggle("farm", farming || hunting);
  $("zoneLevel").textContent = hunting ? t("zone.lairLevel", { n: zone.level }) : t("zone.level", { n: zone.level });
  $("zoneBest").textContent = t("zone.best", { n: state.bestLevel });
  $("teamPower").textContent = fmt(teamStrength(state));

  const pips = [];
  for (let i = 0; i < B.wavesPerLevel; i++) {
    const cls = ["wave-pip"];
    if (i < zone.wave) cls.push("done");
    if (i === zone.wave) cls.push("current");
    if (zone.boss && i === B.wavesPerLevel - 1) cls.push("boss");
    pips.push(`<span class="${cls.join(" ")}"></span>`);
  }
  $("waves").innerHTML = pips.join("");
  $("waves").setAttribute("aria-label", t("zone.wave", { n: zone.wave + 1, total: B.wavesPerLevel }));

  const place = `<button class="btn small" data-action="zoneSheet">📍 ${hunting ? `${zone.boss.icon} ${t(`boss.${zone.boss.id}`)}` : t("place.campaign")} ▾</button>`;
  let hint;
  let main;
  if (hunting) {
    hint = t("zone.huntHint");
    main = `<button class="btn ghost small" data-action="leaveHunt">${t("place.leave")}</button>`;
  } else if (farming) {
    hint = t("zone.hintFarm");
    main = `<button class="btn primary small" data-action="challenge">${zone.boss ? `${zone.boss.icon} ${t("zone.challenge")}` : t("zone.advance")}</button>`;
  } else {
    hint = zone.boss ? t("zone.bossNext", { total: B.wavesPerLevel }) : t("zone.wave", { n: zone.wave + 1, total: B.wavesPerLevel });
    main = `<button class="btn ghost small" data-action="farm">${t("zone.stay")}</button>`;
  }
  $("zoneActions").innerHTML = `${place}<span class="hint">${hint}</span>${main}`;
}

/* ---------- Briques objets ---------- */
function statParts(item) {
  const parts = [];
  const hp = itemStat(item, "hp") * HP_PER_POINT;
  const power = itemStat(item, "power");
  const armor = itemStat(item, "armor");
  if (power) parts.push(`${t("stat.power")} ${fmt(power)}`);
  if (hp) parts.push(`${t("stat.hp")} ${fmt(hp)}`);
  if (armor) parts.push(`${t("stat.armor")} ${fmt(armor)}`);
  return parts;
}

function tile(item, { action = "itemSheet", upgrade = false, extra = "" } = {}) {
  return `
    <button class="tile ${item.rarity}" data-action="${action}" data-id="${item.id}" ${extra} aria-label="${esc(itemName(item))}">
      <span class="tile-icon" aria-hidden="true">${SLOT_ICONS[item.slot]}</span>
      <span class="tile-level num">${item.level}</span>
      ${item.plus ? `<span class="tile-plus num">+${item.plus}</span>` : ""}
      ${upgrade ? '<span class="tile-up" aria-hidden="true">▲</span>' : ""}
      ${item.isNew ? '<span class="tile-new" aria-hidden="true"></span>' : ""}
      ${item.unique ? `<span class="tile-unique" aria-hidden="true">${uniqueIcon(item.unique)}</span>` : ""}
      ${item.locked ? '<span class="tile-lock" aria-hidden="true">🔒</span>' : ""}
    </button>`;
}

function setBlock(setId, owned = 0) {
  const bonus = (n) =>
    `<li class="${owned >= n ? "on" : ""}"><b>${t("set.pieces", { n })}</b> ${fxList(SETS[setId][n]).join(" · ")}</li>`;
  return `<div class="set-block"><span class="set-name">${t(`set.${setId}`)}${owned ? ` · ${owned}/5` : ""}</span><ul>${bonus(2)}${bonus(4)}</ul></div>`;
}

export function itemDetail(item, hero = null) {
  const focus = item.focus && item.focus !== "balanced" ? `<span class="tag ${item.focus}">${t(`focus.${item.focus}`)}</span>` : "";
  const affixes = Object.entries(item.affixes || {}).map(([k, v]) => `<li>${fxText(k, v)}</li>`).join("");
  const unique = item.unique
    ? `<div class="unique">${uniqueIcon(item.unique)}<div><b>${t(`unique.${item.unique}`)}</b><br>${Object.entries(UNIQUES[item.unique]).map(([k, v]) => fxText(k, v)).join(" · ")}</div></div>`
    : "";
  const classAffix = item.classAffix
    ? `<div class="class-affix${hero && hero.classId !== item.classAffix.classId ? " off" : ""}">${classIcon(item.classAffix.classId)} <b>${esc(className(item.classAffix.classId))}</b> : ${fxList(item.classAffix.fx).join(" · ")}</div>`
    : "";
  const owned = hero && item.setId ? SLOT_KEYS.filter((s) => s !== item.slot && hero.gear[s]?.setId === item.setId).length + 1 : 0;
  return `
    <div class="item-detail">
      <div class="item-title">
        <span class="item-icon ${item.rarity}" aria-hidden="true">${SLOT_ICONS[item.slot]}</span>
        <div>
          <div class="item-name r-${item.rarity}">${esc(itemName(item))}</div>
          <div class="item-meta">${t(`rarity.${item.rarity}`)} · ${t("item.level", { n: item.level })} ${focus}</div>
        </div>
      </div>
      <div class="item-stats">${statParts(item).map((p) => `<span>${p}</span>`).join("")}</div>
      ${affixes ? `<ul class="affix-list">${affixes}</ul>` : ""}
      ${classAffix}
      ${unique}
      ${item.setId ? setBlock(item.setId, owned) : ""}
    </div>`;
}

// Tableau de comparaison : héros actuel → héros avec l'objet.
function compareTable(hero, item, state) {
  const before = computeHero(hero, state);
  const after = computeHero(hero, state, { ...hero.gear, [item.slot]: item });
  const rows = [
    ["stat.power", before.power, after.power, fmt],
    ["stat.hp", before.hp, after.hp, fmt],
    ["stat.armor", before.armor, after.armor, fmt],
    ["stat.crit", before.crit, after.crit, (v) => `${pct(v)} %`],
    ["stat.haste", before.haste, after.haste, (v) => `${pct(v)} %`],
  ];
  const lines = rows
    .filter(([, a, b]) => Math.abs(a - b) > 1e-6 || a)
    .map(([key, a, b, f]) => {
      const diff = b - a;
      const cls = Math.abs(diff) < 1e-6 ? "" : diff > 0 ? "up" : "down";
      const sign = diff > 0 ? "+" : "";
      const delta = Math.abs(diff) < 1e-6 ? "=" : key === "stat.crit" || key === "stat.haste" ? `${sign}${pct(diff)}` : `${sign}${fmt(diff)}`;
      return `<tr><td>${t(key)}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${cls}">${delta}</td></tr>`;
    })
    .join("");
  const gain = gainFromItem(hero, item, state);
  const cls = gain > 0.001 ? "up" : gain < -0.001 ? "down" : "";
  return `
    <div class="table-wrap"><table class="compare">
      <thead><tr><th></th><th>${t("sheet.current")}</th><th>${t("sheet.new")}</th><th></th></tr></thead>
      <tbody>${lines}<tr class="total"><td>${t("sheet.overall")}</td><td></td><td></td><td class="${cls}">${gain > 0 ? "+" : ""}${pct(gain)} %</td></tr></tbody>
    </table></div>`;
}

export function bestTarget(state, item) {
  let best = null;
  for (const hero of state.heroes) {
    const gain = gainFromItem(hero, item, state);
    if (!best || gain > best.gain) best = { hero, gain };
  }
  return best;
}

const isUpgrade = (state, item) => state.heroes.some((h) => gainFromItem(h, item, state) > 0.001);

/* ---------- Équipe ---------- */
export function renderTeam(state) {
  const hero = state.heroes[ui.hero];
  const s = computeHero(hero, state);
  const reduction = damageReduction(s.armor, state.zone.level);
  const cap = state.maxLevel + B.heroLevelCap;
  const need = xpToNext(hero.level);
  const ult = ULTIMATES[hero.role];

  const tabs = state.heroes
    .map(
      (h, i) => `
      <button class="hero-tab${i === ui.hero ? " active" : ""}" data-action="pickHero" data-index="${i}">
        <span class="unit-icon" aria-hidden="true">${classIcon(h.classId)}</span>
        <span>${esc(className(h.classId))}</span>
        <span class="muted">${t("team.level", { n: h.level })}</span>
      </button>`
    )
    .join("");

  const slot = (key) => {
    const item = hero.gear[key];
    const better = state.inventory.some((i) => i.slot === key && gainFromItem(hero, i, state) > 0.001);
    if (!item) {
      return `<button class="doll-slot empty" style="grid-area:${key}" data-action="slotSheet" data-slot="${key}" aria-label="${t(`slot.${key}`)}">
        <span class="tile-icon" aria-hidden="true">${SLOT_ICONS[key]}</span>${better ? '<span class="tile-up" aria-hidden="true">▲</span>' : ""}</button>`;
    }
    return `<button class="doll-slot tile ${item.rarity}" style="grid-area:${key}" data-action="slotSheet" data-slot="${key}" aria-label="${esc(itemName(item))}">
      <span class="tile-icon" aria-hidden="true">${SLOT_ICONS[key]}</span>
      <span class="tile-level num">${item.level}</span>
      ${item.plus ? `<span class="tile-plus num">+${item.plus}</span>` : ""}
      ${better ? '<span class="tile-up" aria-hidden="true">▲</span>' : ""}
    </button>`;
  };

  const sets = Object.entries(s.sets)
    .filter(([, n]) => n >= 1)
    .map(([id, n]) => `<span class="chip set-chip${n >= 2 ? " on" : ""}">${t("set.count", { name: t(`set.${id}`), n })}</span>`)
    .join("");
  const uniques = s.uniques.map((u) => `<span class="chip unique-chip">${uniqueIcon(u)} ${t(`unique.${u}`)}</span>`).join("");
  const effects = fxList(Object.fromEntries(Object.entries(s.fx).filter(([k]) => !["aoeFactor", "singleFactor"].includes(k))));

  $("tab-team").innerHTML = `
    <div class="hero-tabs">${tabs}</div>
    <section class="panel">
      <div class="doll">
        ${SLOT_KEYS.map(slot).join("")}
        <button class="doll-portrait" style="grid-area:portrait" data-action="classSheet" aria-label="${t("team.changeClass")}">
          <span class="portrait-icon" aria-hidden="true">${classIcon(hero.classId)}<span class="portrait-swap">⇄</span></span>
          <b>${esc(className(hero.classId))}</b>
          <span class="muted small-text">${t(`role.${hero.role}`)} · ${t("team.level", { n: hero.level })}</span>
          <div class="bar xp" aria-label="XP"><i style="width:${Math.min(100, (hero.xp / need) * 100)}%"></i></div>
        </button>
      </div>
      ${hero.level >= cap ? `<p class="muted small-text">${t("team.capped")}</p>` : ""}
      <div class="stat-strip">
        <span><small>${t("stat.power")}</small><b class="num">${fmt(s.power)}</b></span>
        <span><small>${t("stat.hp")}</small><b class="num">${fmt(s.hp)}</b></span>
        <span><small>${t("stat.armor")}</small><b class="num">${pct(reduction)} %</b></span>
        <span><small>${t("stat.crit")}</small><b class="num">${pct(s.crit)} %</b></span>
        <span><small>${t("stat.haste")}</small><b class="num">+${pct(s.haste)} %</b></span>
      </div>
      <div class="fx-box">
        <div class="chips">${sets}${uniques}</div>
        <p class="small-text muted">${effects.length ? effects.join(" · ") : t("team.noEffects")}</p>
        <p class="small-text"><b class="r-legendary">${t("ult.title")} · ${t(`ult.${ult.id}`)}</b> <span class="muted">${t(`ult.${ult.id}.desc`)}</span></p>
      </div>
    </section>`;
}

/* ---------- Fiches ---------- */
export function slotSheet(state, slotKey) {
  const hero = state.heroes[ui.hero];
  const item = hero.gear[slotKey];
  let current = `<p class="muted">${t("sheet.nothingWorn")}</p>`;
  if (item) {
    const cost = forgeCost(item);
    const forge = canForge(item)
      ? `<button class="btn small primary" data-action="forge" data-slot="${slotKey}" ${state.gold < cost ? "disabled" : ""}>⚒ ${t("team.forge")} +${item.plus + 1} · ${fmt(cost)}</button>`
      : `<span class="muted small-text">${t("team.forgeMax")}</span>`;
    const reroll = canReroll(item)
      ? `<button class="btn small" data-action="reroll" data-slot="${slotKey}" ${state.gold < rerollCost(item) ? "disabled" : ""} title="${t("sheet.rerollHint")}">🎲 ${t("sheet.reroll")} · ${fmt(rerollCost(item))}</button>`
      : "";
    const remove = `<button class="btn small ghost" data-action="unequip" data-slot="${slotKey}" ${state.inventory.length >= B.inventorySize ? "disabled" : ""}>${t("team.unequip")}</button>`;
    current = `${itemDetail(item, hero)}<div class="item-actions">${forge}${reroll}${remove}</div>`;
  }

  const candidates = state.inventory
    .filter((i) => i.slot === slotKey)
    .map((i) => ({ item: i, gain: gainFromItem(hero, i, state) }))
    .sort((a, b) => b.gain - a.gain)
    .map(({ item: i, gain }) => {
      const cls = gain > 0.001 ? "up" : gain < -0.001 ? "down" : "";
      return `
        <div class="cand">
          ${tile(i, { upgrade: gain > 0.001 })}
          <div class="cand-body">
            <span class="item-name r-${i.rarity}">${esc(itemName(i))}</span>
            <span class="small-text muted">${[...statParts(i), ...fxList(i.affixes), ...(i.unique ? [`✦ ${t(`unique.${i.unique}`)}`] : [])].join(" · ")}</span>
          </div>
          <div class="cand-side">
            <span class="delta ${cls}">${gain > 0 ? "+" : ""}${pct(gain)} %</span>
            <button class="btn small ${gain > 0.001 ? "primary" : ""}" data-action="equipItem" data-id="${i.id}" data-hero="${ui.hero}">${t("bag.equipNoGain")}</button>
          </div>
        </div>`;
    })
    .join("");

  return `
    <div class="sheet-head"><h2>${SLOT_ICONS[slotKey]} ${t(`slot.${slotKey}`)} · ${esc(className(hero.classId))}</h2><button class="icon-btn" data-action="closeSheet" aria-label="${t("settings.close")}">✕</button></div>
    <h3>${t("sheet.equipped")}</h3>
    ${current}
    <h3>${t("sheet.candidates")}</h3>
    ${candidates || `<p class="muted small-text">${t("sheet.noCandidates")}</p>`}`;
}

export function itemSheet(state, id) {
  const item = state.inventory.find((i) => i.id === id);
  if (!item) return null;
  item.isNew = false;
  const best = bestTarget(state, item);
  if (ui.compareHero == null) ui.compareHero = state.heroes.indexOf(best.hero);
  const hero = state.heroes[ui.compareHero];
  const chips = state.heroes
    .map((h, i) => {
      const gain = gainFromItem(h, item, state);
      return `<button class="chip${i === ui.compareHero ? " on" : ""}" data-action="compareHero" data-index="${i}" data-id="${item.id}" aria-pressed="${i === ui.compareHero}">${classIcon(h.classId)} <span class="${gain > 0.001 ? "up" : gain < -0.001 ? "down" : ""}">${gain > 0 ? "+" : ""}${pct(gain)} %</span></button>`;
    })
    .join("");
  const worn = hero.gear[item.slot];

  return `
    <div class="sheet-head"><h2>${t("nav.bag")}</h2><button class="icon-btn" data-action="closeSheet" aria-label="${t("settings.close")}">✕</button></div>
    ${itemDetail(item, hero)}
    <div class="toggle-row"><span class="small-text muted">${t("sheet.compareWith")}</span><div class="chips">${chips}</div></div>
    ${compareTable(hero, item, state)}
    ${worn ? `<details class="worn"><summary>${t("sheet.equipped")} : <span class="r-${worn.rarity}">${esc(itemName(worn))}</span></summary>${itemDetail(worn, hero)}</details>` : ""}
    <div class="item-actions">
      <button class="btn primary" data-action="equipItem" data-id="${item.id}" data-hero="${ui.compareHero}">${t("sheet.equipOn", { hero: esc(className(hero.classId)) })}</button>
      <button class="btn" data-action="sellItem" data-id="${item.id}" ${item.locked ? "disabled" : ""}>${t("bag.sell", { gold: fmt(sellValue(item)) })}</button>
      <button class="btn" data-action="salvageItem" data-id="${item.id}" ${item.locked ? "disabled" : ""}>♻ ${t("craft.salvage", { n: salvageValue(item) })}</button>
      <button class="btn ghost" data-action="lockItem" data-id="${item.id}">${item.locked ? t("bag.unlock") : t("bag.lock")}</button>
    </div>`;
}

export function classSheet(state) {
  const hero = state.heroes[ui.hero];
  const classes = CLASS_KEYS.filter((id) => CLASSES[id].role === hero.role)
    .map((id) => {
      const unlocked = isClassUnlocked(state, id);
      const unlock = CLASSES[id].unlock;
      const lockText = unlock?.boss ? t("unlock.boss", { boss: t(`boss.${unlock.boss}`) }) : unlock ? t("unlock.awakenings", { n: unlock.awakenings }) : "";
      return `
        <button class="class-opt${hero.classId === id ? " active" : ""}" data-action="setClass" data-class="${id}" ${unlocked ? "" : "disabled"}>
          <b class="class-name">${classIcon(id)} ${esc(className(id))}</b>
          <small>${unlocked ? t(`passive.${id}`) : `<span class="lock">🔒 ${esc(lockText)}</span>`}</small>
        </button>`;
    })
    .join("");
  const specUnlocked = hero.level >= SPEC_LEVEL;
  const current = hero.specs?.[hero.classId];
  const specs = SPECS[hero.classId]
    .map(
      (fx, i) => `
      <button class="class-opt${current === i ? " active" : ""}" data-action="setSpec" data-spec="${i}" ${specUnlocked ? "" : "disabled"}>
        <b>${t(`spec.${hero.classId}.${i}`)}</b>
        <small>${fxList(fx).join(" · ")}</small>
      </button>`
    )
    .join("");
  return `
    <div class="sheet-head"><h2>${t("team.class")} · ${t(`role.${hero.role}`)}</h2><button class="icon-btn" data-action="closeSheet" aria-label="${t("settings.close")}">✕</button></div>
    <p class="muted small-text">${t(`role.${hero.role}.desc`)}</p>
    <div class="class-list">${classes}</div>
    <h3>${t("spec.title", { cls: esc(className(hero.classId)) })}</h3>
    <p class="muted small-text">${specUnlocked ? t("spec.hint") : t("spec.locked", { n: SPEC_LEVEL })}</p>
    <div class="class-list">${specs}</div>`;
}

export function zoneSheet(state) {
  const zone = activeZone(state);
  if (ui.huntLevel == null) ui.huntLevel = Math.max(1, state.maxLevel - 2);
  ui.huntLevel = Math.max(1, Math.min(state.maxLevel, ui.huntLevel));
  const lairs = BOSSES.map((boss) => {
    const open = lairUnlocked(state, boss.id);
    const here = zone.kind === "hunt" && zone.boss.id === boss.id;
    return `
      <div class="place-card${here ? " here" : ""}${open ? "" : " locked"}" style='--bg: ${bgUrl(boss.id)}'>
        <div class="place-head"><span class="place-icon" aria-hidden="true">${bossArt(boss.id)}</span><b>${t(`boss.${boss.id}`)}</b></div>
        ${setBlock(boss.id)}
        ${open
          ? here
            ? `<span class="muted small-text">${t("place.here")} · ${t("zone.lairLevel", { n: zone.level })}</span>`
            : `<button class="btn small primary" data-action="startHunt" data-boss="${boss.id}">${t("place.go")} · ${t("zone.lairLevel", { n: ui.huntLevel })}</button>`
          : `<span class="muted small-text">🔒 ${t("place.locked", { boss: t(`boss.${boss.id}`) })}</span>`}
      </div>`;
  }).join("");
  return `
    <div class="sheet-head"><h2>${t("place.title")}</h2><button class="icon-btn" data-action="closeSheet" aria-label="${t("settings.close")}">✕</button></div>
    <div class="place-card${zone.kind === "campaign" ? " here" : ""}" style='--bg: ${bgUrl("campaign")}'>
      <div class="place-head"><span class="place-icon" aria-hidden="true">🗺️</span><b>${t("place.campaign")}</b></div>
      <p class="small-text muted">${t("place.campaignDesc")}</p>
      ${zone.kind === "campaign" ? `<span class="muted small-text">${t("place.here")} · ${t("zone.level", { n: state.zone.level })}</span>` : `<button class="btn small primary" data-action="leaveHunt">${t("place.go")}</button>`}
    </div>
    <p class="small-text muted">${t("place.lairDesc")}</p>
    <div class="toggle-row"><span>${t("place.level")}</span>
      <div class="stepper">
        <button class="btn small" data-action="huntLevel" data-step="-5" aria-label="-5">−5</button>
        <button class="btn small" data-action="huntLevel" data-step="-1" aria-label="-1">−</button>
        <b class="num">${ui.huntLevel}</b>
        <button class="btn small" data-action="huntLevel" data-step="1" aria-label="+1">+</button>
        <button class="btn small" data-action="huntLevel" data-step="5" aria-label="+5">+5</button>
      </div>
    </div>
    <div class="toggle-row"><span>${t("mod.title")}</span><div class="chips">${modChips(state)}</div></div>
    <p class="small-text muted">${(zone.kind === "hunt" ? state.hunt.mods : ui.huntMods).map((k) => t(`mod.${k}.desc`)).join(" · ") || t("mod.none")}</p>
    <div class="place-grid">${lairs}</div>`;
}

function modChips(state) {
  const active = state.hunt ? state.hunt.mods : ui.huntMods;
  return Object.keys(MODIFIERS)
    .map((k) => `<button class="chip${active.includes(k) ? " on" : ""}" data-action="toggleMod" data-mod="${k}" aria-pressed="${active.includes(k)}">${t(`mod.${k}`)}</button>`)
    .join("");
}

/* ---------- Sac ---------- */
export function renderBag(state) {
  const items = state.inventory
    .filter((i) => ui.bagFilter === "all" || i.slot === ui.bagFilter)
    .map((item) => ({ item, up: isUpgrade(state, item) }))
    .sort((a, b) => b.up - a.up || (RARITIES.findIndex((r) => r.key === b.item.rarity) - RARITIES.findIndex((r) => r.key === a.item.rarity)) || b.item.level - a.item.level);

  const sellable = state.inventory.filter((i) => !i.locked);
  const sellTotal = sellable.reduce((sum, i) => sum + sellValue(i), 0);
  const filters = ["all", ...SLOT_KEYS]
    .map((f) => `<button class="chip${ui.bagFilter === f ? " on" : ""}" data-action="bagFilter" data-filter="${f}" aria-pressed="${ui.bagFilter === f}">${f === "all" ? t("bag.filterAll") : `${SLOT_ICONS[f]}<span class="sr-only"> ${t(`slot.${f}`)}</span>`}</button>`)
    .join("");
  const autoSell = RARITIES.slice(0, 3)
    .map((r) => `<button class="chip${state.settings.autoSell.includes(r.key) ? " on" : ""}" data-action="toggleAutoSell" data-rarity="${r.key}" aria-pressed="${state.settings.autoSell.includes(r.key)}">${t(`rarity.${r.key}`)}</button>`)
    .join("");

  const lairs = state.bossesDefeated;
  if (!ui.craftSet || !lairs.includes(ui.craftSet)) ui.craftSet = lairs[0] || null;
  const craft = lairs.length
    ? `
      <div class="chips">${lairs.map((id) => `<button class="chip${ui.craftSet === id ? " on" : ""}" data-action="craftSet" data-set="${id}" aria-pressed="${ui.craftSet === id}">${t(`set.${id}`)}</button>`).join("")}</div>
      <div class="chips">${SLOT_KEYS.map((k) => `<button class="chip${ui.craftSlot === k ? " on" : ""}" data-action="craftSlot" data-slot="${k}" aria-pressed="${ui.craftSlot === k}">${SLOT_ICONS[k]}<span class="sr-only"> ${t(`slot.${k}`)}</span></button>`).join("")}</div>
      <button class="btn primary small" data-action="craft" ${canCraft(state, ui.craftSet) ? "" : "disabled"}>⚒ ${t("craft.make", { slot: t(`slot.${ui.craftSlot}`), n: state.maxLevel, cost: CRAFT.setCost })}</button>`
    : `<p class="muted small-text">${t("craft.locked")}</p>`;
  const salvageTotal = sellable.reduce((sum, i) => sum + salvageValue(i), 0);

  $("tab-bag").innerHTML = `
    <section class="panel">
      <div class="level-row">
        <h3>${t("nav.bag")} · <span class="num">${t("bag.count", { n: state.inventory.length, max: B.inventorySize })}</span></h3>
        <span class="coin">${currencyIcon("shards")}<span class="num">${fmt(state.shards || 0)}</span></span>
      </div>
      <div class="item-actions">
        <button class="btn small" data-action="sellAll" ${sellable.length ? "" : "disabled"}>${t("bag.sellAll", { gold: fmt(sellTotal) })}</button>
        <button class="btn small" data-action="salvageAll" ${sellable.length ? "" : "disabled"}>♻ ${t("craft.salvageAll", { n: salvageTotal })}</button>
      </div>
      <div class="chips">${filters}</div>
      ${state.inventory.length >= B.inventorySize ? `<p class="small-text r-legendary">${t("bag.full")}</p>` : ""}
      ${items.length ? `<div class="bag-grid">${items.map(({ item, up }) => tile(item, { upgrade: up })).join("")}</div>` : `<p class="muted small-text">${t("bag.empty")}</p>`}
    </section>
    <section class="panel">
      <h3>${t("craft.title")}</h3>
      <p class="muted small-text">${t("craft.intro")}</p>
      ${craft}
    </section>
    <details class="panel options">
      <summary>${t("bag.options")}</summary>
      <label class="toggle-row" for="autoEquip">
        <span class="small-text">${t("bag.autoEquip")}</span>
        <span class="switch"><input type="checkbox" id="autoEquip" data-action="toggleAutoEquip" ${state.settings.autoEquip ? "checked" : ""}><span></span></span>
      </label>
      <div class="toggle-row"><span class="small-text">${t("bag.autoSell")}</span><div class="chips">${autoSell}</div></div>
    </details>`;
}

/* ---------- Objectifs du jour ---------- */
export function renderQuests(state) {
  const list = state.quests?.list || [];
  const reward = questReward(state);
  const rows = list
    .map((q, i) => {
      const done = q.progress >= q.target;
      return `
        <div class="quest${q.claimed ? " claimed" : ""}">
          <div class="quest-body">
            <span class="small-text">${t(`quest.${q.type}`, { n: q.target })}</span>
            <div class="bar xp"><i style="width:${(q.progress / q.target) * 100}%"></i></div>
          </div>
          ${q.claimed
            ? `<span class="muted small-text">✓</span>`
            : `<button class="btn small ${done ? "primary" : ""}" data-action="claimQuest" data-index="${i}" ${done ? "" : "disabled"}>${done ? t("quest.claim") : `<span class="num">${q.progress}/${q.target}</span>`}</button>`}
        </div>`;
    })
    .join("");
  const html = `
    <div class="level-row"><h3>${t("quest.title")}</h3><span class="muted small-text">${t("quest.reward", { shards: reward.shards, gold: fmt(reward.gold) })}</span></div>
    ${rows}`;
  const box = $("quests");
  if (box.dataset.html !== html) {
    box.innerHTML = html;
    box.dataset.html = html;
  }
}

/* ---------- Éveil ---------- */
export function renderAwaken(state) {
  const souls = pendingSouls(state);
  const ready = souls > 0;
  const upgrades = Object.keys(AWAKENING)
    .map((key) => {
      const a = AWAKENING[key];
      const rank = state.awakening[key] || 0;
      const maxed = a.max && rank >= a.max;
      const cost = awakeningCost(state, key);
      return `
        <div class="upgrade">
          <div><b>${t(`up.${key}`)}</b> <span class="muted small-text">${t("up.rank", { n: rank })}</span><small>${t(`up.${key}.desc`)}</small></div>
          <button class="btn small ${maxed ? "" : "primary"}" data-action="buyUpgrade" data-key="${key}" ${maxed || state.souls < cost ? "disabled" : ""}>${maxed ? t("awaken.max") : t("awaken.buy", { cost: fmt(cost) })}</button>
        </div>`;
    })
    .join("");

  const button = !ready
    ? `<p class="muted small-text">${t("awaken.need", { n: B.prestigeMinLevel, best: state.maxLevel })}</p>`
    : ui.confirmAwaken
      ? `<div class="item-actions"><button class="btn danger" data-action="awakenConfirm">${t("awaken.confirm")}</button><button class="btn ghost" data-action="awakenCancel">${t("awaken.cancel")}</button></div>`
      : `<button class="btn primary" data-action="awaken">✴️ ${t("awaken.btn")}</button>`;

  const codex = [
    ...Object.keys(UNIQUES).map((id) => ({ on: state.codex.uniques.includes(id), icon: uniqueIcon(id), label: t(`unique.${id}`), cls: "r-legendary" })),
    ...BOSSES.map((b) => ({ on: state.bossesDefeated.includes(b.id), icon: bossArt(b.id), label: t(`boss.${b.id}`), cls: "" })),
    ...BOSSES.map((b) => ({ on: state.codex.sets.includes(b.id), icon: "◈", label: t(`set.${b.id}`), cls: "r-set" })),
  ]
    .map((e) => `<span class="codex-entry${e.on ? " on" : ""}" title="${esc(e.label)}"><span class="${e.on ? e.cls : ""}" aria-hidden="true">${e.on ? e.icon : "?"}</span><small>${e.on ? esc(e.label) : "???"}</small></span>`)
    .join("");

  const stars = starsAvailable(state);
  const transcendBtn = !stars
    ? `<p class="muted small-text">${t("trans.need", { n: TRANSCEND.minLevel })}</p>`
    : ui.confirmTranscend
      ? `<div class="item-actions"><button class="btn danger" data-action="transcendConfirm">${t("trans.confirm", { n: stars })}</button><button class="btn ghost" data-action="transcendCancel">${t("awaken.cancel")}</button></div>`
      : `<button class="btn primary" data-action="transcend">🌟 ${t("trans.btn", { n: stars })}</button>`;

  $("tab-awaken").innerHTML = `
    <section class="panel">
      <p class="muted">${t("awaken.intro")}</p>
      <div class="soul-hero">
        <div><div class="muted small-text">${t("awaken.pending")}</div><div class="soul-count num">+${fmt(souls)}</div></div>
        <div class="muted small-text">${t("awaken.count", { n: state.awakenings })}</div>
      </div>
      ${button}
      <p class="small-text muted">${t("awaken.keeps")}<br>${t("awaken.loses")}</p>
    </section>
    <section class="panel">
      <div class="level-row"><h3>${t("awaken.upgrades")}</h3><span class="coin">${currencyIcon("souls")}<span class="num">${fmt(state.souls)}</span></span></div>
      ${upgrades}
    </section>
    <section class="panel">
      <div class="level-row"><h3>${t("codex.title")}</h3><span class="muted small-text num">${codexCount(state)}/${codexTotal()} · +${pct(codexBonus(state))} %</span></div>
      <p class="muted small-text">${t("codex.intro")}</p>
      <div class="codex-grid">${codex}</div>
    </section>
    <section class="panel">
      <div class="level-row"><h3>${t("trans.title")}</h3><span class="muted small-text">🌟 ${state.stars || 0}</span></div>
      <p class="muted small-text">${t("trans.intro", { power: pct(TRANSCEND.power), souls: pct(TRANSCEND.souls) })}</p>
      ${state.stars ? `<p class="small-text">${t("trans.current", { power: pct(starBonus(state)), souls: pct(soulBonus(state) - 1) })}</p>` : ""}
      ${transcendBtn}
    </section>`;
}

/* ---------- Défis : tour d'épreuves et succès ---------- */
export function renderChallenges(state) {
  const trial = state.trial;
  const rules = (trial?.rules || [])
    .map((r) => `<div class="rule"><b>${t(`rule.${r}`)}</b><small>${t(`rule.${r}.desc`)}</small></div>`)
    .join("");
  const action = trial?.active
    ? `<p class="small-text">${t("trial.running", { n: trial.floor })}</p><button class="btn ghost small" data-action="leaveTrial">${t("trial.leave")}</button>`
    : `<button class="btn primary" data-action="startTrial">🗼 ${t("trial.start")}</button>`;

  const done = new Set(state.achievements || []);
  const list = ACHIEVEMENTS.map((a) => {
    const value = Math.min(a.target, a.value(state));
    const ok = done.has(a.id);
    return `
      <div class="ach${ok ? " done" : ""}">
        <span class="ach-icon" aria-hidden="true">${ok ? "🏆" : "◇"}</span>
        <div class="ach-body">
          <b>${t(`ach.${a.id}`)}</b>
          <small>${t(`achd.${a.id.replace(/\d+$/, "")}`, { n: fmt(a.target) })}</small>
          ${ok ? "" : `<div class="bar xp"><i style="width:${(value / a.target) * 100}%"></i></div>`}
        </div>
        <span class="ach-reward num">${ok ? "✓" : `+${a.shards}`}</span>
      </div>`;
  }).join("");

  $("tab-challenges").innerHTML = `
    <section class="panel">
      <div class="level-row"><h3>🗼 ${t("trial.title")}</h3><span class="muted small-text">${t("trial.bestWeek", { n: trial?.best || 0 })} · ${t("trial.bestEver", { n: state.trialBestEver || 0 })}</span></div>
      <p class="muted small-text">${t("trial.intro", { lvl: floorLevel(1), step: TRIAL.perFloor, shards: floorShards(1) })}</p>
      <div class="rules">${rules}</div>
      ${action}
    </section>
    <section class="panel">
      <div class="level-row"><h3>🏆 ${t("ach.title")}</h3><span class="muted small-text num">${done.size}/${ACHIEVEMENTS.length}</span></div>
      <div class="ach-list">${list}</div>
    </section>`;
}
