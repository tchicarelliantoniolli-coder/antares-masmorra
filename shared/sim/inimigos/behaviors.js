import { moveToward, enemySpeed, enemyShoot } from './Enemy.js';
import { bossXerox } from './chefes/xerox.js';

function wander(world, e, dt) {
  e.wanderT -= dt;
  if (e.wanderT <= 0) {
    e.wanderA = world.rng.range(0, Math.PI * 2);
    e.wanderT = world.rng.range(0.8, 2);
  }
  const s = enemySpeed(e) * 0.5;
  const r = world.map.moveBox(e, Math.cos(e.wanderA) * s * dt, Math.sin(e.wanderA) * s * dt);
  if (r.hitX || r.hitY) e.wanderT = 0;
}

/** Caderno Zumbi: persegue, prepara e dá um bote. */
function chaser(world, e, dt, target) {
  if (!target) return wander(world, e, dt);
  const L = e.def.lunge;
  const d = Math.hypot(target.x - e.x, target.y - e.y);
  e.cd -= dt;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) { e.state = 'lunge'; e.t = L.duration; e.contactOverride = 1; }
    return;
  }
  if (e.state === 'lunge') {
    e.t -= dt;
    const r = world.map.moveBox(e, Math.cos(e.aim) * L.speed * dt, Math.sin(e.aim) * L.speed * dt);
    if (e.t <= 0 || r.hitX || r.hitY) { e.state = 'move'; e.cd = L.cooldown; e.contactOverride = undefined; }
    return;
  }
  // persegue com uma leve ondulação (parece zumbi)
  const wob = Math.sin(world.time * 3 + e.id) * 0.5;
  const a = Math.atan2(target.y - e.y, target.x - e.x) + wob;
  const s = enemySpeed(e);
  world.map.moveBox(e, Math.cos(a) * s * dt, Math.sin(a) * s * dt);
  e.facing = target.x > e.x ? 1 : -1;
  if (L && d < L.range && e.cd <= 0) {
    e.state = 'windup';
    e.t = L.windup;
    e.aim = Math.atan2(target.y - e.y, target.x - e.x);
  }
}

/** Mantém distância, anda de lado e atira. */
function shooter(world, e, dt, target) {
  if (!target) return wander(world, e, dt);
  const atk = e.def.attack;
  const [minR, maxR] = e.def.preferredRange || [140, 240];
  const d = Math.hypot(target.x - e.x, target.y - e.y);
  e.facing = target.x > e.x ? 1 : -1;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) {
      enemyShoot(world, e, Math.atan2(target.y - e.y, target.x - e.x), atk);
      e.state = 'move';
      e.cd = atk.interval * world.rng.range(0.85, 1.15);
    }
    return;
  }
  const s = enemySpeed(e);
  if (d < minR) moveToward(world, e, target.x, target.y, s, dt, -1);
  else if (d > maxR) moveToward(world, e, target.x, target.y, s, dt, 1);
  else {
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeDir *= -1; e.strafeT = world.rng.range(1, 2.5); }
    const a = Math.atan2(target.y - e.y, target.x - e.x) + (Math.PI / 2) * e.strafeDir;
    const r = world.map.moveBox(e, Math.cos(a) * s * 0.7 * dt, Math.sin(a) * s * 0.7 * dt);
    if (r.hitX || r.hitY) e.strafeDir *= -1;
  }
  e.cd -= dt;
  if (e.cd <= 0 && world.map.lineOfSight(e.x, e.y, target.x, target.y)) {
    e.state = 'windup';
    e.t = atk.windup;
  }
}

export const BEHAVIORS = {
  chaser,
  shooter,
  fan_shooter: shooter, // mesmo movimento; a diferença está no ataque (leque de 3 lápis)
  boss_xerox: bossXerox
};
