import { DEG, angleDiff } from '../math.js';
import { damageEnemy } from '../combat.js';
import { damageProp } from '../salas/Props.js';
import { TILE, T } from '../constants.js';
import { startCooldown, critChanceOf, emitShoot } from './common.js';

/** Golpe em arco (o corpo a corpo de sempre). */
export const swing = {
  hold(world, p, w) {
    if (p.fireCd > 0) return;
    startCooldown(p, w);
    meleeSwing(world, p, w, critChanceOf(p, w));
    emitShoot(world, p, w);
  }
};

/** Estocada: avança na direção da mira acertando quem estiver no caminho (o movimento fica em updateDash). */
export const thrust = {
  hold(world, p, w) {
    if (p.fireCd > 0 || p.dash) return;
    const T = w.melee.thrust;
    const speed = T.distance / T.time;
    startCooldown(p, w);
    p.dash = { vx: Math.cos(p.aim) * speed, vy: Math.sin(p.aim) * speed, t: T.time, hit: new Set(), weaponId: w.id };
    world.emit('thrust', { playerId: p.id, x: p.x, y: p.y, angle: p.aim });
    emitShoot(world, p, w);
  }
};

/** Anda a estocada: para na parede, acerta cada inimigo uma vez. Jogador fica invulnerável (combat.hurtPlayer). */
export function updateDash(world, p, dt) {
  const d = p.dash;
  const w = world.data.weapon(d.weaponId);
  const res = world.map.moveBox(p, d.vx * dt, d.vy * dt);
  p.moving = true;
  const angle = Math.atan2(d.vy, d.vx);
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.burrowed || d.hit.has(e.id)) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) > p.r + e.r + 12) continue;
    d.hit.add(e.id);
    damageEnemy(world, e, w.damage, { crit: world.rng.chance(critChanceOf(p, w)), source: p, effect: w.effect, knockback: w.melee.knockback, angle });
  }
  d.t -= dt;
  if (d.t <= 0 || res.hitX || res.hitY) p.dash = null;
}

/** Combo: sequência de golpes; o último é mais forte e mais largo. Parar de bater volta ao primeiro. */
export const combo = {
  hold(world, p, w) {
    if (p.fireCd > 0) return;
    const C = w.melee.combo;
    const ws = p.wstate;
    const finisher = ws.combo === C.steps - 1;
    startCooldown(p, w, finisher ? 1.3 : 1);
    meleeSwing(world, p, w, critChanceOf(p, w), { damageMul: finisher ? C.finisherMul : 1, arcBonus: finisher ? C.finisherArcBonus : 0, step: ws.combo });
    ws.combo = (ws.combo + 1) % C.steps;
    ws.comboT = C.resetTime;
    emitShoot(world, p, w);
  },
  idle(world, p, w, dt) {
    const ws = p.wstate;
    if (ws.comboT > 0) { ws.comboT -= dt; if (ws.comboT <= 0) ws.combo = 0; }
  }
};

/** Escudo: segurando, bloqueia balas de frente (Projectiles.js); ao soltar, dá um empurrão. */
export const shield = {
  hold(world, p) { p.wstate.shielding = true; },
  idle(world, p) { p.wstate.shielding = false; },
  release(world, p, w) {
    p.wstate.shielding = false;
    if (p.fireCd > 0) return;
    startCooldown(p, w);
    meleeSwing(world, p, w, critChanceOf(p, w), { knockback: w.melee.shield.bashKnockback });
    emitShoot(world, p, w);
  }
};

/** Estilos de corpo a corpo. Mesma interface dos modos de disparo. */
export const MELEE_STYLES = { swing, thrust, combo, shield };

/** Tenta bloquear uma bala inimiga com o escudo levantado. true = bloqueou. */
export function shieldBlocks(world, pl, bullet) {
  if (!pl.wstate?.shielding) return false;
  const w = world.data.weapon(pl.weapons[pl.cur]);
  const S = w.melee?.shield;
  if (!S) return false;
  const a = Math.atan2(bullet.y - pl.y, bullet.x - pl.x);
  if (Math.abs(angleDiff(pl.aim, a)) > (S.arc / 2) * DEG) return false;
  const cost = S.blockCost * pl.mods.energyCostMul;
  if (pl.energy < cost) { pl.wstate.shielding = false; return false; }
  pl.energy -= cost;
  world.emit('block', { x: bullet.x, y: bullet.y, playerId: pl.id });
  return true;
}

/** Ataque corpo a corpo: acerta todos no arco e corta/rebate balas. */
export function meleeSwing(world, p, w, critChance, { damageMul = 1, arcBonus = 0, knockback = w.melee.knockback, step = 0 } = {}) {
  const m = { ...w.melee, arc: w.melee.arc + arcBonus, knockback };
  const reach = m.range;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.burrowed) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > reach + e.r) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    if (d > e.r + 6 && Math.abs(angleDiff(p.aim, a)) > (m.arc / 2) * DEG) continue;
    damageEnemy(world, e, w.damage * damageMul, {
      crit: world.rng.chance(critChance), source: p, effect: w.effect,
      knockback: m.knockback, angle: a
    });
  }
  // caixas e barris no alcance do golpe
  const map = world.map;
  const tr = Math.ceil(reach / TILE) + 1;
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let ty = pty - tr; ty <= pty + tr; ty++) for (let tx = ptx - tr; tx <= ptx + tr; tx++) {
    if (map.get(tx, ty) !== T.PROP) continue;
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d > reach + 16) continue;
    if (d > 24 && Math.abs(angleDiff(p.aim, Math.atan2(cy - p.y, cx - p.x))) > (m.arc / 2) * DEG) continue;
    damageProp(world, tx, ty, w.damage * damageMul);
  }
  if (m.deflect) {
    for (const q of world.projectiles) {
      if (q.team !== 'enemy' || q.dead) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > reach + 8) continue;
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      if (Math.abs(angleDiff(p.aim, a)) > (m.arc / 2 + 10) * DEG) continue;
      if (m.reflect) {
        q.team = 'player';
        q.owner = p;
        q.damage = Math.max(2, q.damage * 3);
        q.vx = Math.cos(p.aim) * q.speed * 1.4;
        q.vy = Math.sin(p.aim) * q.speed * 1.4;
        q.traveled = 0;
        q.range = 500;
        q.hit = new Set();
        world.emit('reflect', { x: q.x, y: q.y });
      } else {
        q.dead = true;
        world.emit('deflect', { x: q.x, y: q.y });
      }
    }
  }
  world.emit('swing', { playerId: p.id, x: p.x, y: p.y, angle: p.aim, arc: m.arc, range: reach, weaponId: w.id, step });
}
