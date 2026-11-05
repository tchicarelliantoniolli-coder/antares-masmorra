import { moveToward, enemySpeed, enemyShoot, nearestPlayer } from './Enemy.js';
import { bossXerox } from './chefes/xerox.js';
import { bossKatia } from './chefes/katia.js';
import { bossSamara } from './chefes/samara.js';
import { explode, hurtPlayer } from '../combat.js';

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
    if (e.t <= 0 || r.hitX || r.hitY) { e.state = 'move'; e.cd = L.cooldown * e.atkMul; e.contactOverride = undefined; }
    return;
  }
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

/** Mantém distância, anda de lado e atira (Prova Voadora, Estojo). */
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
      e.cd = atk.interval * e.atkMul * world.rng.range(0.85, 1.15);
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

/** Lousa: fica parada e dispara giz em 8 direções, alternando + e ×. */
function turret(world, e, dt, target) {
  const atk = e.def.attack;
  if (target) e.facing = target.x > e.x ? 1 : -1;
  e.cd -= dt;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) {
      e.turn = (e.turn || 0) + 1;
      const off = e.turn % 2 ? Math.PI / 8 : 0;
      const n = atk.bullets + (e.elite ? 4 : 0);
      enemyShoot(world, e, off, { ...atk, bullets: n, spread: 360 - 360 / n, noExtra: true });
      if (target && e.turn % 3 === 0) enemyShoot(world, e, Math.atan2(target.y - e.y, target.x - e.x), { ...atk, bullets: 3, spread: 20, speed: atk.speed * 1.3, noExtra: true });
      e.state = 'move';
      e.cd = atk.interval * e.atkMul;
    }
    return;
  }
  if (e.cd <= 0 && target) { e.state = 'windup'; e.t = atk.windup; }
}

/** Sinal do Recreio: flutua e "toca", soltando anéis de ondas sonoras com uma abertura. */
function ringer(world, e, dt, target) {
  const atk = e.def.attack;
  if (!target) return wander(world, e, dt);
  e.facing = target.x > e.x ? 1 : -1;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) {
      const n = atk.bullets;
      const gapAt = Math.atan2(target.y - e.y, target.x - e.x) + world.rng.range(-1, 1);
      for (let i = 0; i < n; i++) {
        const a = gapAt + 0.5 + (i / n) * (Math.PI * 2 - 1);
        enemyShoot(world, e, a, { ...atk, bullets: 1, spread: 0, noExtra: true });
      }
      e.rings = (e.rings || 0) + 1;
      if (e.rings < (e.elite ? 3 : 2)) { e.t = 0.35; } else { e.rings = 0; e.state = 'move'; e.cd = atk.interval * e.atkMul; }
      world.emit('bell', { x: e.x, y: e.y });
    }
    return;
  }
  e.wanderT -= dt;
  if (e.wanderT <= 0) { e.wanderA = Math.atan2(target.y - e.y, target.x - e.x) + world.rng.range(-1.5, 1.5); e.wanderT = world.rng.range(0.6, 1.4); }
  const s = enemySpeed(e);
  const r = world.map.moveBox(e, Math.cos(e.wanderA) * s * dt, Math.sin(e.wanderA) * s * dt);
  if (r.hitX || r.hitY) e.wanderT = 0;
  e.cd -= dt;
  if (e.cd <= 0) { e.state = 'windup'; e.t = atk.windup; }
}

/** Mochila-bomba: corre até o jogador, acende o pavio e explode. */
function kamikaze(world, e, dt, target) {
  if (e.state === 'fuse') {
    e.t -= dt;
    if (e.t <= 0) {
      e.exploded = true;
      e.dead = true;
      e.minion = true;
      explode(world, e.x, e.y, 60, 6, { hurtsPlayers: true, style: 'barrel', playerDamage: 2 });
    }
    return;
  }
  if (!target) return wander(world, e, dt);
  const d = Math.hypot(target.x - e.x, target.y - e.y);
  moveToward(world, e, target.x, target.y, enemySpeed(e), dt);
  if (d < 46) { e.state = 'fuse'; e.t = 0.65; world.emit('fuse', { x: e.x, y: e.y }); }
}

/** Aluno da Assembleia (Katia): anda devagar para o centro da roda, empurrando quem estiver na frente. */
function assembly(world, e, dt) {
  const s = enemySpeed(e);
  const d = Math.hypot(e.cx - e.x, e.cy - e.y);
  if (d > e.stopR) moveToward(world, e, e.cx, e.cy, s, dt);
}

/** Divã (Katia, fase 2): parado; cura a Katia enquanto existir. */
function healer(world, e, dt) {
  const boss = world.enemies.find((b) => b.def.boss && !b.dead && b.roomId === e.roomId);
  if (!boss) return;
  boss.hp = Math.min(boss.maxHp, boss.hp + e.def.healPerSecond * dt * (world.players.length > 1 ? 1.5 : 1));
  e.healTarget = boss.id;
}

/** Caderno Preto (Samara): persegue um jogador; quem é pego fica "assinando" e não pode atacar. */
function capturer(world, e, dt) {
  let target = world.players.find((p) => p.id === e.targetId && !p.downed && !p.dead && !(p.signing > 0) && !(p.jailTimer > 0));
  if (!target) target = nearestPlayer(world, e);
  if (!target) return;
  e.targetId = target.id;
  const a = Math.atan2(target.y - e.y, target.x - e.x);
  const s = enemySpeed(e);
  e.x += Math.cos(a) * s * dt; // atravessa obstáculos (é um caderno gigante voando)
  e.y += Math.sin(a) * s * dt;
  e.facing = Math.cos(a) > 0 ? 1 : -1;
  if (Math.hypot(target.x - e.x, target.y - e.y) < target.r + e.r) {
    const solo = world.players.filter((p) => !p.dead).length === 1;
    target.signing = solo ? 3 : 5;
    target.signFree = 0;
    hurtPlayer(world, target, 1);
    world.emit('signing', { id: target.id, x: target.x, y: target.y });
    e.dead = true;
    e.minion = true;
    world.emit('enemy_vanish', { x: e.x, y: e.y, id: e.id, enemyType: e.type });
  }
}

export const BEHAVIORS = {
  chaser,
  shooter,
  fan_shooter: shooter, // mesmo movimento; a diferença está no ataque (leque de lápis)
  turret,
  ringer,
  kamikaze,
  assembly,
  healer,
  capturer,
  boss_xerox: bossXerox,
  boss_katia: bossKatia,
  boss_samara: bossSamara
};
