
import { damageEnemy, hurtPlayer } from '../combat.js';
import { spawnProjectile } from '../armas/Projectiles.js';
import { BEHAVIORS } from './behaviors.js';

export function createEnemy(world, type, x, y, roomId, { spawnTime = 0.9, minion = false } = {}) {
  const def = world.data.enemy(type);
  const players = Math.max(1, world.players.length);
  const scale = (world.floorDef.hpScale || 1) * (def.boss ? 1 + 0.6 * (players - 1) : 1);
  const e = {
    id: world.newId(), kind: 'enemy', type, def,
    x, y, r: def.radius,
    hp: Math.round(def.hp * scale), maxHp: Math.round(def.hp * scale),
    roomId, minion,
    spawning: spawnTime,
    state: 'move', t: 0,
    cd: world.rng.range(0.6, 1.6),     // primeiro ataque com atraso aleatório
    aim: 0, facing: 1,
    kx: 0, ky: 0, flash: 0,
    status: {}, contactCd: 0,
    strafeDir: world.rng.chance(0.5) ? 1 : -1, strafeT: world.rng.range(1, 2.5),
    wanderA: world.rng.range(0, Math.PI * 2), wanderT: 0,
    dead: false
  };
  world.enemies.push(e);
  world.emit('enemy_spawn', { id: e.id, x, y, enemyType: type, boss: !!def.boss });
  return e;
}

export function nearestPlayer(world, e) {
  let best = null, bd = Infinity;
  for (const p of world.players) {
    if (p.dead || p.downed) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

export function enemySpeed(e) {
  let s = e.def.speed;
  if (e.status.slow > 0) s *= e.status.slowMul ?? 0.5;
  return s * (e.speedMul || 1);
}

export function moveToward(world, e, tx, ty, speed, dt, sign = 1) {
  const a = Math.atan2(ty - e.y, tx - e.x);
  const res = world.map.moveBox(e, Math.cos(a) * speed * dt * sign, Math.sin(a) * speed * dt * sign);
  if (Math.cos(a) * sign !== 0) e.facing = Math.cos(a) * sign > 0 ? 1 : -1;
  return res;
}

export function enemyShoot(world, e, angle, atk) {
  const n = atk.bullets || 1;
  for (let i = 0; i < n; i++) {
    const a = n > 1 ? angle + ((-atk.spread / 2 + (atk.spread * i) / (n - 1)) * Math.PI) / 180 : angle;
    spawnProjectile(world, {
      team: 'enemy', x: e.x, y: e.y - 4, angle: a,
      speed: atk.speed, radius: atk.radius || 5, damage: atk.damage || 1,
      range: atk.range || 900, sprite: 'ebullet_' + (atk.style || 'paper'), style: atk.style || 'paper',
      slow: atk.slow || 0
    });
  }
  world.emit('enemy_shoot', { x: e.x, y: e.y, style: atk.style, boss: !!e.def.boss });
}

function tickStatus(world, e, dt) {
  const s = e.status;
  for (const k of ['burn', 'poison']) {
    const st = s[k];
    if (!st) continue;
    st.t -= dt;
    st.tick += dt;
    if (st.tick >= 0.5) {
      st.tick = 0;
      damageEnemy(world, e, Math.max(1, st.dps * 0.5), { source: st.src, noMul: true });
    }
    if (st.t <= 0) s[k] = null;
  }
  if (s.slow > 0) s.slow -= dt;
  if (s.frozen > 0) s.frozen -= dt;
}

export function updateEnemies(world, dt) {
  for (const e of world.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.spawning > 0) { e.spawning -= dt; continue; }
    tickStatus(world, e, dt);
    if (e.dead) continue;
    if (e.kx || e.ky) {
      world.map.moveBox(e, e.kx * dt, e.ky * dt);
      const f = Math.pow(0.001, dt);
      e.kx *= f; e.ky *= f;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 5) e.kx = e.ky = 0;
    }
    e.contactCd = Math.max(0, e.contactCd - dt);
    if (e.status.stun > 0) { e.status.stun -= dt; continue; }
    const target = nearestPlayer(world, e);
    const fn = BEHAVIORS[e.def.behavior];
    if (fn) fn(world, e, dt, target);
    // dano de contato
    const cdmg = e.contactOverride ?? e.def.contactDamage;
    if (cdmg && e.contactCd <= 0) {
      for (const p of world.players) {
        if (p.dead || p.downed) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r - 2) {
          if (hurtPlayer(world, p, cdmg)) e.contactCd = 0.8;
        }
      }
    }
  }
  separate(world);
}

/** Empurra inimigos sobrepostos para não ficarem empilhados. */
function separate(world) {
  const list = world.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.spawning > 0) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || b.spawning > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = a.r + b.r;
      if (d >= min) continue;
      const push = (min - d) / 2;
      const nx = dx / d, ny = dy / d;
      const aBoss = !!a.def.boss, bBoss = !!b.def.boss;
      if (!aBoss) world.map.moveBox(a, -nx * push * (bBoss ? 2 : 1), -ny * push * (bBoss ? 2 : 1));
      if (!bBoss) world.map.moveBox(b, nx * push * (aBoss ? 2 : 1), ny * push * (aBoss ? 2 : 1));
    }
  }
}

