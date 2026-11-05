import { angleDiff } from '../../math.js';
import { damageEnemy, chainFrom } from '../../combat.js';
import { createArea } from '../../areas.js';
import { spawnShot } from '../shots.js';
import { tryPay, startCooldown, emitShoot, critChanceOf } from '../common.js';

/** Ponto mirado no chão: até maxRange na direção da mira, passando por cima de obstáculos e parando antes de paredes. */
export function aimPoint(world, p, maxRange, angle = p.aim) {
  const r = world.map.groundRaycast(p.x, p.y, angle, Math.min(p.aimDist, maxRange));
  return { x: r.x, y: r.y };
}

/** Arremesso em arco: passa por cima de tudo e cai no ponto mirado. */
export const lob = {
  hold(world, p, w) {
    if (p.fireCd > 0 || !tryPay(world, p, w)) return;
    const L = w.lob;
    const dist = Math.min(p.aimDist, L.maxRange);
    const shots = spawnShot(world, p, w, { proj: { ...w.projectile, ghost: true, homing: 0, boomerang: false, bounce: 0 } });
    for (const q of shots) {
      const a = Math.atan2(q.vy, q.vx);
      const t = world.map.groundRaycast(p.x, p.y, a, dist);
      q.lob = { sx: q.x, sy: q.y, tx: t.x, ty: t.y, t: 0, flight: L.flightTime, peak: L.peak, bounces: L.bounces, fuse: L.fuse, waiting: 0 };
      q.z = 0;
      q.range = Infinity;
      if (L.pool) q.pool = L.pool;
    }
    startCooldown(p, w);
    emitShoot(world, p, w);
  }
};

/** Chuva: marca vários pontos em volta do alvo; cada um causa dano quando o aviso acaba. */
export const rain = {
  hold(world, p, w) {
    if (p.fireCd > 0 || !tryPay(world, p, w)) return;
    const R = w.rain;
    const c = aimPoint(world, p, R.maxRange);
    const crit = critChanceOf(p, w);
    for (let i = 0; i < R.count; i++) {
      let x = c.x, y = c.y;
      for (let tries = 0; tries < 6; tries++) {
        const a = world.rng.range(0, Math.PI * 2), d = Math.sqrt(world.rng.next()) * R.radius;
        const nx = c.x + Math.cos(a) * d, ny = c.y + Math.sin(a) * d;
        if (!world.map.solidAt(nx, ny)) { x = nx; y = ny; break; }
      }
      createArea(world, 'rain_mark', x, y, {
        r: R.hitRadius, life: R.delay + i * 0.08, damage: w.damage, crit: world.rng.chance(crit),
        effect: w.effect, ownerId: p.id, sprite: 'proj_' + w.id
      });
    }
    startCooldown(p, w);
    emitShoot(world, p, w);
  }
};

/** Raio em cadeia: acerta na hora o inimigo mais perto da mira e pula entre vizinhos. */
export const chain = {
  hold(world, p, w) {
    if (p.fireCd > 0) return;
    const C = w.chain;
    const mx = p.x + Math.cos(p.aim) * 18, my = p.y + Math.sin(p.aim) * 18 - 4;
    let best = null, bestA = Infinity;
    for (const e of world.enemies) {
      if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > C.range) continue;
      const da = Math.abs(angleDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x)));
      if (da > (C.aimCone * Math.PI) / 180 || da >= bestA) continue;
      if (!world.map.lineOfSight(mx, my, e.x, e.y)) continue;
      best = e; bestA = da;
    }
    startCooldown(p, w);
    if (!best) {
      world.emit('chain', { points: [[mx, my], [mx + Math.cos(p.aim) * 60, my + Math.sin(p.aim) * 60]] });
      return;
    }
    if (!tryPay(world, p, w)) return;
    damageEnemy(world, best, w.damage, { crit: world.rng.chance(critChanceOf(p, w)), source: p, effect: w.effect, knockback: p.mods.knockback, angle: p.aim });
    const pts = chainFrom(world, best, { chains: C.chains, radius: C.radius, damage: w.damage, falloff: C.falloff, source: p, effect: w.effect });
    world.emit('chain', { points: [[mx, my], ...pts] });
    emitShoot(world, p, w);
  }
};
