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

/** Estilos de corpo a corpo. Mesma interface dos modos de disparo. */
export const MELEE_STYLES = { swing };

/** Ataque corpo a corpo: acerta todos no arco e corta/rebate balas. */
export function meleeSwing(world, p, w, critChance, { damageMul = 1, arcBonus = 0 } = {}) {
  const m = { ...w.melee, arc: w.melee.arc + arcBonus };
  const reach = m.range;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0) continue;
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
  world.emit('swing', { playerId: p.id, x: p.x, y: p.y, angle: p.aim, arc: m.arc, range: reach, weaponId: w.id });
}
