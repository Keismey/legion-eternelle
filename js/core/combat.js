// Moteur de combat en temps réel, sans DOM. `step` avance de `dt` secondes
// et signale ce qui se passe via `emit(type, données)`.
// Tous les bonus passent par `hero.stats.fx` (voir data/effects.js).
import { BALANCE as B, ELITES, BOSS_PHASE, COMBO } from "../data/config.js";
import { ROLES } from "../data/classes.js";
import { MONSTERS, CORRUPTIONS, CORRUPT_HP } from "../data/bosses.js";
import { computeHero } from "./heroes.js";
import { monsterStats, bossStats, damageReduction } from "./curve.js";
import { activeZone } from "./zones.js";

// Ultimes : un par rôle. La jauge se remplit en agissant et en encaissant.
export const ULTIMATES = {
  tank: { id: "rally", duration: 5, guard: 0.5 }, // l'équipe subit -50 % pendant 5 s
  dps: { id: "assault", power: 4 }, // un coup à 400 % de Puissance
  mage: { id: "cataclysm", power: 2.2 }, // 220 % sur tous les ennemis
  heal: { id: "renewal", power: 2.5, revive: 0.3 }, // soin de groupe + relève les morts à 30 %
};

function pickGroupSize(rng, b) {
  let roll = rng() * b.groupSizes.reduce((t, g) => t + g.weight, 0);
  for (const g of b.groupSizes) {
    roll -= g.weight;
    if (roll <= 0) return g.count;
  }
  return 1;
}

export function createBattle(state, opts = {}) {
  const { rng = Math.random, b = B, autoUltimate = false } = opts;
  const zone = activeZone(state, b);
  const level = zone.level;
  const boss = zone.bossWave ? zone.boss : null;

  const heroes = state.heroes.map((hero, i) => {
    const stats = computeHero(hero, state, null, b);
    return {
      index: i,
      ref: hero,
      stats,
      hp: stats.hp,
      maxHp: stats.hp,
      timer: rng() * stats.attackInterval * 0.5,
      alive: true,
      revived: false,
      frenzy: 0,
      // La jauge d'ultime est conservée d'une vague à l'autre (voir game.js).
      charge: Math.min(100, opts.charges?.[i] || 0),
    };
  });

  let monsters;
  if (boss) {
    const s = bossStats(level, boss, b);
    const corruption = zone.corrupted ? CORRUPTIONS[boss.id] : null;
    const hp = Math.round(s.hp * (corruption ? CORRUPT_HP : 1));
    monsters = [{
      index: 0, key: boss.id, icon: boss.icon, boss, hp, maxHp: hp, atk: s.atk, defense: s.defense,
      timer: 1, skillEvery: boss.skill.every, skillTimer: boss.skill.every, phase: 1, shield: 0, dot: null, alive: true,
      corruption, corruptTimer: corruption?.every || 0, reflectT: 0,
    }];
  } else {
    const count = pickGroupSize(rng, b);
    const s = monsterStats(level, count, b);
    monsters = Array.from({ length: count }, (_, i) => ({
      index: i,
      key: MONSTERS[Math.floor(rng() * MONSTERS.length)],
      boss: null,
      hp: s.hp,
      maxHp: s.hp,
      atk: s.atk,
      defense: s.defense,
      timer: b.monster.attackInterval * (0.6 + rng() * 0.6),
      shield: 0,
      dot: null,
      alive: true,
    }));
    // Une chance qu'un des monstres soit une élite
    if (rng() < ELITES.chance * (opts.eliteBoost || 1)) {
      const types = Object.keys(ELITES.types);
      const type = types[Math.floor(rng() * types.length)];
      const trait = ELITES.types[type];
      const m = monsters[0];
      m.elite = type;
      m.hp = m.maxHp = Math.round(m.hp * ELITES.hp);
      m.atk *= ELITES.atk * (trait.atk || 1);
      m.defense = Math.min(0.6, m.defense + (trait.defense || 0));
      m.regen = trait.regen || 0;
      m.vamp = trait.vamp || 0;
    }
  }
  if (opts.modifiers) {
    for (const m of monsters) {
      m.hp = m.maxHp = Math.round(m.hp * (opts.modifiers.hp || 1));
      m.atk *= opts.modifiers.atk || 1;
    }
  }
  // Règles de la tour d'épreuves
  const rules = opts.rules || null;
  if (rules) {
    for (const h of heroes) {
      h.hp = h.maxHp = Math.round(h.maxHp * rules.heroHp);
      h.stats.crit = Math.min(0.9, h.stats.crit + rules.crit);
    }
  }

  const bossTimer = b.bossTimer + (opts.modifiers?.bossTimer || 0);
  // place : le décor du combat (le boss, son repaire, ou la campagne)
  const place = boss ? boss.id : zone.kind === "hunt" ? zone.boss.id : "campaign";
  return {
    level, zone: zone.kind, place, boss, heroes, monsters, elapsed: 0, over: null, rng, b, rally: 0, autoUltimate, bossTimer, lastUlt: -99,
    noHeal: rules?.noHeal || false,
    noUlt: rules?.noUlt || false,
    monsterSpeed: rules?.monsterSpeed || 1,
  };
}

const living = (list) => list.filter((u) => u.alive);

function hurtMonster(battle, monster, amount, emit, crit = false) {
  if (!monster.alive) return 0;
  let dmg = amount * (1 - monster.defense);
  if (monster.shield > 0) {
    const absorbed = Math.min(monster.shield, dmg);
    monster.shield -= absorbed;
    dmg -= absorbed;
  }
  dmg = Math.max(1, dmg);
  monster.hp -= dmg;
  emit("hit", { side: "monster", index: monster.index, amount: dmg, crit });
  if (monster.hp <= 0) {
    monster.hp = 0;
    monster.alive = false;
    emit("death", { side: "monster", index: monster.index });
  }
  return dmg;
}

function healHero(target, amount, emit, battle = null) {
  if (!target?.alive || battle?.noHeal) return 0;
  if (battle?.curse) amount *= battle.curse;
  const real = Math.min(amount, target.maxHp - target.hp);
  target.hp += real;
  if (real > 0.5) emit("heal", { index: target.index, amount: real });
  return real;
}

function woundedHeroes(battle) {
  return living(battle.heroes)
    .filter((h) => h.hp < h.maxHp)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
}

function charge(hero, amount) {
  hero.charge = Math.min(100, hero.charge + amount);
}

// Un coup sur une cible, avec tous les effets offensifs.
function strike(battle, hero, target, factor, emit) {
  const fx = hero.stats.fx;
  const crit = battle.rng() < hero.stats.crit;
  let amount = hero.stats.power * factor * (crit ? hero.stats.critMult : 1);
  if (fx.executioner && target.hp / target.maxHp < 0.3) amount *= 1 + fx.executioner;
  const dealt = hurtMonster(battle, target, amount, emit, crit);
  if (fx.burn && target.alive) target.dot = { dps: (dealt * fx.burn) / 3, left: 3 };
  if (target.reflectT > 0) hurtHero(battle, hero, dealt * target.corruption.share, null, emit);
  return dealt;
}

function heroAct(battle, hero, emit, repeat = false) {
  const { rng } = battle;
  const role = ROLES[hero.ref.role];
  const fx = hero.stats.fx;
  const targets = living(battle.monsters);
  if (!targets.length) return;
  if (!repeat) charge(hero, battle.b.ultCharge.action);

  if (role.action === "heal") {
    const wounded = woundedHeroes(battle);
    if (wounded.length) {
      const crit = rng() < hero.stats.crit;
      const amount = hero.stats.power * role.factor * (1 + (fx.healPct || 0)) * (crit ? hero.stats.critMult : 1);
      if (fx.healAll) living(battle.heroes).forEach((h) => healHero(h, amount * fx.healAll, emit, battle));
      else healHero(wounded[0], amount, emit, battle);
      if (fx.healSplash && wounded[1]) healHero(wounded[1], amount * fx.healSplash, emit, battle);
      return;
    }
    strike(battle, hero, targets[0], 0.4, emit);
    return;
  }

  let dealt = 0;
  if (role.action === "blast" && !fx.singleFactor) {
    const factor = fx.aoeFactor || role.factor;
    targets.forEach((m) => (dealt += strike(battle, hero, m, factor, emit)));
  } else {
    let factor = fx.singleFactor || role.factor;
    if (fx.rage) factor *= 1 + fx.rage * (1 - hero.hp / hero.maxHp);
    const target = targets[0];
    dealt = strike(battle, hero, target, factor, emit);
    const others = living(battle.monsters).filter((m) => m !== target);
    if (fx.cleave) others.forEach((m) => hurtMonster(battle, m, dealt * fx.cleave, emit));
    if (fx.chain && rng() < fx.chain) others.forEach((m) => hurtMonster(battle, m, dealt * 0.5, emit));
  }

  if (fx.lifesteal) healHero(hero, dealt * fx.lifesteal, emit, battle);
  if (fx.leech) {
    const target = woundedHeroes(battle)[0];
    if (target) healHero(target, dealt * fx.leech, emit, battle);
  }
  if (fx.frenzy && hero.frenzy < 10) {
    hero.frenzy++;
    hero.stats.attackInterval = battle.b.heroAttackInterval / (1 + hero.stats.haste + hero.frenzy * fx.frenzy);
  }
  if (!repeat && fx.doubleStrike && rng() < fx.doubleStrike) heroAct(battle, hero, emit, true);
}

function teamGuard(battle) {
  const guard = living(battle.heroes).reduce((t, h) => t + (h.stats.fx.guard || 0), 0);
  return Math.min(0.3, guard) + (battle.rally > 0 ? ULTIMATES.tank.guard : 0);
}

function hurtHero(battle, hero, rawDamage, attacker, emit) {
  if (!hero?.alive) return;
  const fx = hero.stats.fx;
  if (fx.block && battle.rng() < Math.min(0.5, fx.block)) {
    emit("block", { index: hero.index });
    return;
  }
  const reduction = damageReduction(hero.stats.armor, battle.level, battle.b);
  const dmg = rawDamage * (1 - reduction) * (1 - Math.min(0.8, teamGuard(battle)));
  hero.hp -= dmg;
  charge(hero, battle.b.ultCharge.hit);
  emit("hit", { side: "hero", index: hero.index, amount: dmg });
  if (attacker?.alive) {
    if (fx.thorns) hurtMonster(battle, attacker, dmg * fx.thorns, emit);
    if (fx.retaliate && battle.rng() < fx.retaliate) strike(battle, hero, attacker, 0.8, emit);
  }
  if (hero.hp <= 0) {
    if (fx.phoenix && !hero.revived) {
      hero.revived = true;
      hero.hp = hero.maxHp * fx.phoenix;
      emit("revive", { index: hero.index });
      return;
    }
    hero.hp = 0;
    hero.alive = false;
    emit("death", { side: "hero", index: hero.index });
  }
}

function pickHeroTarget(battle) {
  const alive = living(battle.heroes);
  const tank = alive.find((h) => h.ref.role === "tank");
  if (tank && (battle.rally > 0 || battle.rng() < battle.b.tauntChance)) return tank;
  return alive[Math.floor(battle.rng() * alive.length)];
}

function monsterAct(battle, monster, emit) {
  const target = pickHeroTarget(battle);
  const before = target?.hp || 0;
  hurtHero(battle, target, monster.atk, monster, emit);
  if (monster.corruption?.type === "drain" && target) {
    target.charge = Math.max(0, target.charge - monster.corruption.amount);
    emit("drain", { index: target.index });
  }
  if (monster.vamp && target) monster.hp = Math.min(monster.maxHp, monster.hp + Math.max(0, before - target.hp) * monster.vamp);
}

function checkPhase(battle, monster, emit) {
  if (!monster.boss || monster.phase !== 1 || !monster.alive || monster.hp > monster.maxHp * BOSS_PHASE.threshold) return;
  monster.phase = 2;
  monster.atk *= BOSS_PHASE.atk;
  monster.skillEvery *= BOSS_PHASE.skillSpeed;
  monster.skillTimer = Math.min(monster.skillTimer, monster.skillEvery);
  emit("phase", { bossId: monster.boss.id });
}

function bossSkill(battle, monster, emit) {
  const skill = monster.boss.skill;
  emit("skill", { index: monster.index, bossId: monster.boss.id });
  const alive = living(battle.heroes);
  if (!alive.length) return;
  switch (skill.type) {
    case "aoe":
      alive.forEach((h) => hurtHero(battle, h, monster.atk * skill.power, monster, emit));
      break;
    case "flurry":
      hurtHero(battle, pickHeroTarget(battle), monster.atk * skill.power, monster, emit);
      break;
    case "execute":
      hurtHero(battle, [...alive].sort((a, b) => a.hp - b.hp)[0], monster.atk * skill.power, monster, emit);
      break;
    case "regen":
      monster.hp += Math.min(monster.maxHp - monster.hp, monster.maxHp * skill.power);
      break;
    case "shield":
      monster.shield += monster.maxHp * skill.power;
      break;
  }
  if (monster.corruption?.type === "reflect") {
    monster.reflectT = monster.corruption.duration;
    emit("reflect", {});
  }
}

// Mécanismes de corruption, appelés à chaque pas pour un boss corrompu.
function corruptionTick(battle, boss, dt, emit) {
  const c = boss.corruption;
  if (boss.reflectT > 0) boss.reflectT -= dt;
  if (c.type === "curse") battle.curse = c.heal;
  if (!c.every) return;
  boss.corruptTimer -= dt;
  if (boss.corruptTimer > 0) return;
  boss.corruptTimer += c.every;
  const alive = living(battle.heroes);
  switch (c.type) {
    case "summon": {
      const minions = battle.monsters.filter((m) => !m.boss && m.alive).length;
      const add = Math.min(c.count, 4 - minions);
      const s = monsterStats(battle.level, 2, battle.b);
      for (let i = 0; i < add; i++) {
        battle.monsters.push({
          index: battle.monsters.length,
          key: boss.boss.id === "primalDruid" ? "treant" : "shard",
          summoned: true,
          boss: null,
          hp: Math.round(s.hp * 0.6),
          maxHp: Math.round(s.hp * 0.6),
          atk: s.atk * 0.6,
          defense: s.defense,
          timer: battle.b.monster.attackInterval,
          shield: 0,
          dot: null,
          alive: true,
        });
      }
      if (add) emit("summon", { bossId: boss.boss.id });
      break;
    }
    case "enrage":
      boss.atk *= 1 + c.gain;
      boss.enrage = (boss.enrage || 0) + 1;
      break;
    case "bleed":
      alive.forEach((h) => (h.bleed = { dps: h.maxHp * c.dps, left: c.duration }));
      emit("bleed", {});
      break;
    case "nova":
      emit("nova", { bossId: boss.boss.id });
      alive.forEach((h) => hurtHero(battle, h, boss.atk * c.power, boss, emit));
      break;
  }
}

export function canUltimate(battle, index) {
  const hero = battle?.heroes[index];
  return Boolean(hero && hero.alive && hero.charge >= 100 && !battle.over && !battle.noUlt && living(battle.monsters).length);
}

export function castUltimate(battle, index, emit = () => {}) {
  if (!canUltimate(battle, index)) return false;
  const hero = battle.heroes[index];
  const ult = ULTIMATES[hero.ref.role];
  hero.charge = 0;
  // Combo : un ultime lancé peu après un autre (ou pendant le Cri de ralliement) est renforcé.
  const combo = battle.elapsed - battle.lastUlt <= COMBO.window || (hero.ref.role !== "tank" && battle.rally > 0);
  const mult = combo ? 1 + COMBO.bonus : 1;
  battle.lastUlt = battle.elapsed;
  emit("ultimate", { index, role: hero.ref.role, id: ult.id, combo });
  if (combo) emit("combo", { index });
  if (hero.ref.role === "tank") battle.rally = ult.duration * mult;
  else if (hero.ref.role === "dps") strike(battle, hero, living(battle.monsters)[0], ult.power * mult, emit);
  else if (hero.ref.role === "mage") living(battle.monsters).forEach((m) => strike(battle, hero, m, ult.power * mult, emit));
  else {
    const amount = hero.stats.power * ult.power * mult * (1 + (hero.stats.fx.healPct || 0));
    battle.heroes.forEach((h) => {
      if (!h.alive) {
        h.alive = true;
        h.hp = h.maxHp * ult.revive;
        emit("revive", { index: h.index });
      } else healHero(h, amount, emit, battle);
    });
  }
  return true;
}

// Lancement automatique : le tank attend la grosse attaque du boss,
// les autres lancent dès que la jauge est pleine.
function autoUltimates(battle, emit) {
  const boss = battle.monsters.find((m) => m.boss && m.alive);
  for (const hero of battle.heroes) {
    if (!canUltimate(battle, hero.index)) continue;
    const novaSoon = boss?.corruption?.type === "nova" && boss.corruptTimer <= 2;
    if (hero.ref.role === "tank" && boss && boss.skillTimer > 2 && !novaSoon) continue;
    if (hero.ref.role === "heal" && !battle.heroes.some((h) => !h.alive || h.hp < h.maxHp * 0.5)) continue;
    castUltimate(battle, hero.index, emit);
  }
}

export function step(battle, dt, emit = () => {}) {
  if (battle.over) return;
  battle.elapsed += dt;
  if (battle.rally > 0) battle.rally = Math.max(0, battle.rally - dt);
  if (battle.autoUltimate) autoUltimates(battle, emit);

  for (const hero of battle.heroes) {
    if (!hero.alive) continue;
    if (hero.bleed) {
      hero.hp -= hero.bleed.dps * dt;
      hero.bleed.left -= dt;
      if (hero.bleed.left <= 0) hero.bleed = null;
      if (hero.hp <= 0) {
        hero.hp = 0;
        hero.alive = false;
        emit("death", { side: "hero", index: hero.index });
        continue;
      }
    }
    hero.timer -= dt;
    if (hero.timer <= 0) {
      hero.timer += hero.stats.attackInterval;
      heroAct(battle, hero, emit);
    }
  }

  for (const monster of battle.monsters) {
    if (!monster.alive) continue;
    if (monster.dot) {
      monster.hp -= monster.dot.dps * dt;
      monster.dot.left -= dt;
      if (monster.dot.left <= 0) monster.dot = null;
      if (monster.hp <= 0) {
        monster.hp = 0;
        monster.alive = false;
        emit("death", { side: "monster", index: monster.index });
        continue;
      }
    }
    if (monster.regen) monster.hp = Math.min(monster.maxHp, monster.hp + monster.maxHp * monster.regen * dt);
    monster.timer -= dt;
    if (monster.timer <= 0) {
      monster.timer += battle.b.monster.attackInterval * battle.monsterSpeed;
      monsterAct(battle, monster, emit);
    }
    if (monster.boss) {
      if (monster.corruption) corruptionTick(battle, monster, dt, emit);
      checkPhase(battle, monster, emit);
      monster.skillTimer -= dt;
      if (monster.skillTimer <= 0) {
        monster.skillTimer += monster.skillEvery;
        bossSkill(battle, monster, emit);
      }
    }
  }

  if (!living(battle.monsters).length) battle.over = "win";
  else if (!living(battle.heroes).length) battle.over = "lose";
  else if (battle.boss && battle.elapsed >= battle.bossTimer) battle.over = "timeout";
  if (battle.over) emit("end", { result: battle.over });
}

// Combat complet sans affichage (outils de simulation).
export function simulateBattle(state, opts = {}) {
  const battle = createBattle(state, { autoUltimate: true, ...opts });
  while (!battle.over && battle.elapsed < 300) step(battle, 0.1);
  return battle;
}
