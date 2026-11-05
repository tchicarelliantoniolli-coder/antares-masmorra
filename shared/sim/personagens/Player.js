import {
  PLAYER_RADIUS, SHIELD_REGEN_DELAY, SHIELD_REGEN_INTERVAL, REVIVE_TIME, REVIVE_RADIUS
} from '../constants.js';
import { fireWeapon } from '../armas/Weapons.js';
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
    aim: 0, moving: false,
    maxHp: c.stats.hp, hp: c.stats.hp,
    maxShield: c.stats.shield, shield: c.stats.shield,
    maxEnergy: c.stats.energy, energy: c.stats.energy,
    speed: c.stats.speed,
    weapons: [c.starterWeapon],
    cur: 0,
    fireCd: 0, noEnergyCd: 0,
    skillId: c.skill.id,
    skillCooldown: c.skill.cooldown,
    skillCd: 0,
    invuln: 0, shieldDelay: 0, shieldTick: 0,
    slowTimer: 0,
    downed: false, dead: false, reviveProgress: 0,
    roomId: -1,
    coins: 0, kills: 0, damageDealt: 0, damageTaken: 0,
    mods: { critBonus: 0, energyCostMul: 1, damageMul: 1, fireRateMul: 1, speedMul: 1, knockback: 0, skillCdMul: 1, regen: 0 },
    buffs: { nextHitMul: 1, nextHitTimer: 0, hasteTimer: 0 },
    regenTimer: 0,
    interactTarget: null
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
  p.invuln = Math.max(0, p.invuln - dt);
  if (p.downed) {
    updateRevive(world, p, dt);
    return;
  }

  // Movimento
  let mx = inp.moveX || 0, my = inp.moveY || 0;
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  p.moving = ml > 0.1;
  let speed = p.speed * p.mods.speedMul;
  if (p.buffs.hasteTimer > 0) speed *= 1.6;
  if (p.slowTimer > 0) { speed *= 0.55; p.slowTimer -= dt; }
  p.vx = mx * speed;
  p.vy = my * speed;
  world.map.moveBox(p, p.vx * dt, p.vy * dt);

  if (typeof inp.aim === 'number' && !Number.isNaN(inp.aim)) p.aim = inp.aim;

  // Troca de arma (Q)
  if (inp.swap && p.weapons.length > 1) {
    p.cur = (p.cur + 1) % p.weapons.length;
    p.fireCd = Math.max(p.fireCd, 0.12);
    world.emit('weapon_swap', { playerId: p.id, weaponId: p.weapons[p.cur] });
  }

  // Tiro
  p.fireCd -= dt;
  p.noEnergyCd -= dt;
  if (inp.fire && p.fireCd <= 0) fireWeapon(world, p);

  // Habilidade (Espaço)
  p.skillCd = Math.max(0, p.skillCd - dt);
  if (inp.skill) {
    if (p.skillCd <= 0) {
      if (castSkill(world, p)) p.skillCd = p.skillCooldown * p.mods.skillCdMul;
    } else {
      world.emit('skill_not_ready', { playerId: p.id });
    }
  }

  // Interação (E)
  p.interactTarget = findInteractable(world, p);
  if (inp.interact && p.interactTarget) interact(world, p, p.interactTarget);

  // Buffs
  if (p.buffs.nextHitTimer > 0) {
    p.buffs.nextHitTimer -= dt;
    if (p.buffs.nextHitTimer <= 0) p.buffs.nextHitMul = 1;
  }
  if (p.buffs.hasteTimer > 0) p.buffs.hasteTimer -= dt;

  // Escudo regenera depois de alguns segundos sem levar dano
  p.shieldDelay += dt;
  if (p.shieldDelay >= SHIELD_REGEN_DELAY && p.shield < p.maxShield) {
    p.shieldTick += dt;
    if (p.shieldTick >= SHIELD_REGEN_INTERVAL) {
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

/** Jogador caído: um colega perto dele por 3 segundos o levanta. */
function updateRevive(world, p, dt) {
  const helper = world.players.find((q) => q !== p && !q.downed && !q.dead &&
    Math.hypot(q.x - p.x, q.y - p.y) < REVIVE_RADIUS);
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
    p.reviveProgress = Math.max(0, p.reviveProgress - dt * 0.5);
  }
}
