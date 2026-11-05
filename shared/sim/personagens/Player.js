import {
  PLAYER_RADIUS, SHIELD_REGEN_DELAY, SHIELD_REGEN_INTERVAL, REVIVE_TIME, REVIVE_RADIUS, DEFAULT_AIM_DIST, MAX_AIM_DIST
} from '../constants.js';
import { updateWeapon, resetWeaponState } from '../armas/Weapons.js';
import { updateDash } from '../armas/melee.js';
import { castSkill } from './skills.js';
import { applyPassive } from './passives.js';
import { findInteractable, interact } from '../salas/Pickups.js';

export function createPlayer(world, { id, characterId, name, slot = 0 }) {
  const c = world.data.character(characterId);
  const p = {
    id, kind: 'player', slot,
    name: name || c.shortName,
    charId: c.id,
    x: 0, y: 0, r: PLAYER_RADIUS,
    vx: 0, vy: 0,
    aim: 0, aimDist: DEFAULT_AIM_DIST, moving: false, firing: false, prevFire: false,
    maxHp: c.stats.hp, hp: c.stats.hp,
    maxShield: c.stats.shield, shield: c.stats.shield,
    maxEnergy: c.stats.energy, energy: c.stats.energy,
    speed: c.stats.speed,
    weapons: [c.starterWeapon],
    cur: 0,
    fireCd: 0, noEnergyCd: 0,
    wstate: null,                   // estado da arma na mão (carga, aquecimento...), ver armas/common.js
    dash: null,                     // estocada em andamento
    skillId: c.skill.id,
    skillCooldown: c.skill.cooldown,
    skillCd: 0,
    invuln: 0, shieldDelay: 0, shieldTick: 0,
    slowTimer: 0,
    downed: false, dead: false, reviveProgress: 0,
    roomId: -1,
    coins: 0, kills: 0, damageDealt: 0, damageTaken: 0,
    mods: { critBonus: 0, energyCostMul: 1, damageMul: 1, fireRateMul: 1, speedMul: 1, knockback: 0, skillCdMul: 1, shieldRegenMul: 1, regen: 0, allyLifeMul: 1 },
    buffs: { chainReaction: 0, nextHitMul: 1, nextHitTimer: 0, hasteTimer: 0, bubbleTimer: 0, quakeNext: 'terremoto' },
    regenTimer: 0,
    interactTarget: null,
    blessings: [],
    jailTimer: 0, jailFrom: null,   // Suspensão (Samara)
    signing: 0, signFree: 0,        // Caderno Preto (Samara)
    pull: null                      // Conversa Particular (Katia)
  };
  applyPassive(p, c.passive?.id);
  return p;
}

export function updatePlayers(world, dt, inputs) {
  for (const p of world.players) {
    const inp = inputs[p.id] || {};
    updatePlayer(world, p, inp, dt);
  }
}

function updatePlayer(world, p, inp, dt) {
  if (p.dead) return;
  p.firing = !!inp.fire; // usado pelo revive (quem ajuda não pode atirar)
  p.invuln = Math.max(0, p.invuln - dt);
  p.skillCd = Math.max(0, p.skillCd - dt);
  if (p.buffs.bubbleTimer > 0) p.buffs.bubbleTimer -= dt;
  if (p.buffs.hasteTimer > 0) p.buffs.hasteTimer -= dt;
  if (p.buffs.chainReaction > 0) p.buffs.chainReaction = Math.max(0, p.buffs.chainReaction - dt);
  if (p.downed || p.jailTimer > 0 || p.pull || p.signing > 0) clearAction(world, p);
  if (p.downed) {
    updateRevive(world, p, dt);
    return;
  }
  if (typeof inp.aim === 'number' && !Number.isNaN(inp.aim)) p.aim = inp.aim;
  if (typeof inp.aimDist === 'number' && Number.isFinite(inp.aimDist)) p.aimDist = Math.max(0, Math.min(MAX_AIM_DIST, inp.aimDist));

  // Suspensão: preso na cela, fora da luta
  if (p.jailTimer > 0) {
    p.moving = false;
    p.jailTimer -= dt;
    if (p.jailTimer <= 0) {
      p.jailTimer = 0;
      if (p.jailFrom) { p.x = p.jailFrom.x; p.y = p.jailFrom.y; p.jailFrom = null; }
      p.invuln = 1;
      world.emit('jail_free', { id: p.id, x: p.x, y: p.y });
    }
    return;
  }
  // Conversa Particular: é puxado até a orientadora
  if (p.pull) {
    p.moving = true;
    const d = Math.hypot(p.pull.x - p.x, p.pull.y - p.y);
    const step = Math.min(d, 560 * dt);
    if (d > 1) world.map.moveBox(p, ((p.pull.x - p.x) / d) * step, ((p.pull.y - p.y) / d) * step);
    p.pull.t -= dt;
    if (p.pull.t <= 0 || d < 4) p.pull = null;
    return;
  }
  // Caderno Preto: "assinando" — não pode atacar (anda devagar) até acabar ou um colega ajudar
  if (p.signing > 0) {
    p.signing -= dt;
    const helper = world.players.find((q) => q !== p && !q.downed && !q.dead && !(q.signing > 0) && Math.hypot(q.x - p.x, q.y - p.y) < REVIVE_RADIUS);
    if (helper) p.signFree += dt;
    if (p.signFree >= 1 || p.signing <= 0) {
      p.signing = 0;
      p.signFree = 0;
      world.emit('sign_free', { id: p.id, x: p.x, y: p.y, by: helper?.id });
    }
  }
  const signing = p.signing > 0;

  // Movimento
  let mx = inp.moveX || 0, my = inp.moveY || 0;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  p.moving = ml > 0.1;
  let speed = p.speed * p.mods.speedMul;
  if (p.buffs.hasteTimer > 0) speed *= 1.6;
  if (p.wstate?.shielding) speed *= world.data.weapon(p.weapons[p.cur]).melee?.shield?.speedMul ?? 1;
  if (p.slowTimer > 0) { speed *= 0.55; p.slowTimer -= dt; }
  if (signing) speed *= 0.5;
  if (p.dash) updateDash(world, p, dt); // estocada: o movimento é da arma
  else {
    p.vx = mx * speed;
    p.vy = my * speed;
    world.map.moveBox(p, p.vx * dt, p.vy * dt);
  }

  // Troca de arma (Q)
  if (inp.swap && p.weapons.length > 1 && !signing) {
    p.cur = (p.cur + 1) % p.weapons.length;
    p.fireCd = Math.max(p.fireCd, 0.12);
    world.emit('weapon_swap', { playerId: p.id, weaponId: p.weapons[p.cur] });
  }

  // Tiro (cada arma tem seu modo: veja armas/Weapons.js)
  p.noEnergyCd -= dt;
  updateWeapon(world, p, inp, dt);

  // Habilidade (Espaço)
  if (inp.skill && !signing) {
    if (p.skillCd <= 0) {
      if (castSkill(world, p)) p.skillCd = p.skillCooldown * p.mods.skillCdMul;
    } else {
      world.emit('skill_not_ready', { playerId: p.id });
    }
  }

  // Interação (E)
  p.interactTarget = findInteractable(world, p);
  if (inp.interact && p.interactTarget && !signing) interact(world, p, p.interactTarget);

  // Buffs
  if (p.buffs.nextHitTimer > 0) {
    p.buffs.nextHitTimer -= dt;
    if (p.buffs.nextHitTimer <= 0) p.buffs.nextHitMul = 1;
  }
  // Escudo regenera depois de alguns segundos sem levar dano
  p.shieldDelay += dt;
  if (p.shieldDelay >= SHIELD_REGEN_DELAY * p.mods.shieldRegenMul && p.shield < p.maxShield) {
    p.shieldTick += dt;
    if (p.shieldTick >= SHIELD_REGEN_INTERVAL * p.mods.shieldRegenMul) {
      p.shieldTick = 0;
      p.shield++;
      world.emit('shield_regen', { id: p.id });
    }
  } else {
    p.shieldTick = 0;
  }

  // Regeneração de vida (passivo da Vivian)
  if (p.mods.regen > 0 && p.hp < p.maxHp) {
    p.regenTimer += dt;
    if (p.regenTimer >= p.mods.regen) { p.regenTimer = 0; p.hp++; }
  }
}

/** Caiu, foi preso, puxado ou está assinando: para a estocada, solta carga/escudo/rajada e apaga as órbitas. */
function clearAction(world, p) {
  const ws = p.wstate;
  const orbitas = world.projectiles.filter((q) => q.orbit && !q.dead && q.orbit.ownerId === p.id);
  if (!p.dash && !orbitas.length && !(ws && (ws.shielding || ws.charge > 0 || ws.burstLeft > 0 || ws.spin > 0))) return;
  // órbitas somem (como quando o dono cai) para não girar e causar dano com o jogador fora de combate
  for (const q of orbitas) { q.dead = true; world.emit('proj_fade', { x: q.x, y: q.y, style: q.sprite }); }
  p.dash = null;
  p.prevFire = false;
  resetWeaponState(p, world);
}

/** Jogador caído: um colega parado e sem atirar ao lado dele por REVIVE_TIME segundos o levanta. */
function updateRevive(world, p, dt) {
  const helper = world.players.find((q) => q !== p && !q.downed && !q.dead && !(q.signing > 0) && !(q.jailTimer > 0) &&
    !q.moving && !q.firing && Math.hypot(q.x - p.x, q.y - p.y) < REVIVE_RADIUS);
  if (helper) {
    p.reviveProgress += dt;
    if (p.reviveProgress >= REVIVE_TIME) {
      p.downed = false;
      p.reviveProgress = 0;
      p.hp = Math.max(1, Math.ceil(p.maxHp / 2));
      p.invuln = 2;
      world.emit('player_revive', { id: p.id, by: helper.id, x: p.x, y: p.y });
    }
  } else {
    p.reviveProgress = 0;
  }
}
