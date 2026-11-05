import { createAlly, countAllies } from '../../personagens/Allies.js';
import { spawnShot } from '../shots.js';
import { tryPay, fireCooldown, emitShoot } from '../common.js';
import { aimPoint } from './ground.js';

/** Coloca no chão uma mina ou torreta; com o máximo atingido, some a mais antiga. */
export const deploy = {
  hold(world, p, w) {
    if (p.fireCd > 0 || !tryPay(world, p, w)) return;
    const D = w.deploy;
    let { x, y } = aimPoint(world, p, 60);
    if (world.map.solidAt(x, y)) { x = p.x; y = p.y; }
    if (countAllies(world, p.id, D.kind) >= D.max) {
      const old = world.allies.filter((a) => !a.dead && a.ownerId === p.id && a.kind === D.kind).sort((a, b) => a.id - b.id)[0];
      old.dead = true;
      world.emit('ally_end', { x: old.x, y: old.y, kind: old.kind });
    }
    createAlly(world, D.kind, x, y, {
      ownerId: p.id, weaponId: w.id, life: D.life, damage: D.damage, radius: D.radius, fireRate: D.fireRate,
      range: D.range, triggerRadius: D.triggerRadius, sprite: 'proj_' + w.id, cd: 0.4, r: D.kind === 'mine' ? 8 : 12
    });
    fireCooldown(world, p, w);
    world.emit('deploy', { kind: D.kind, x, y, playerId: p.id });
    emitShoot(world, p, w);
  }
};

/** Projéteis em órbita do jogador. */
export function orbiters(world, p) {
  return world.projectiles.filter((q) => q.orbit && !q.dead && q.orbit.ownerId === p.id);
}

/** Lança na direção da mira todos os projéteis que estão girando em volta do jogador. */
export function launchOrbiters(world, p) {
  const list = orbiters(world, p);
  // todos convergem para o ponto mirado (senão saem em linhas paralelas e erram alvos pequenos)
  const d = Math.max(80, p.aimDist);
  const tx = p.x + Math.cos(p.aim) * d, ty = p.y + Math.sin(p.aim) * d;
  for (const q of list) {
    const sp = q.orbit.launchSpeed;
    const a = Math.atan2(ty - q.y, tx - q.x);
    q.vx = Math.cos(a) * sp;
    q.vy = Math.sin(a) * sp;
    q.speed = sp;
    q.range = q.orbit.range;
    q.traveled = 0;
    q.hit = new Set();
    q.orbit = null;
  }
  if (list.length) world.emit('orbit_launch', { playerId: p.id, x: p.x, y: p.y, n: list.length });
  return list.length;
}

/** Órbita: cada disparo põe um projétil girando em volta; com o máximo, o próximo disparo lança todos. */
export const orbit = {
  hold(world, p, w) {
    if (p.fireCd > 0) return;
    const O = w.orbit;
    const n = orbiters(world, p).length;
    if (n >= O.max) {
      launchOrbiters(world, p);
      fireCooldown(world, p, w);
      emitShoot(world, p, w);
      return;
    }
    if (!tryPay(world, p, w)) return;
    for (const q of spawnShot(world, p, w, { countOverride: 1 })) {
      q.orbit = { ownerId: p.id, angle: (n / O.max) * Math.PI * 2 + world.time * O.spin, radius: O.radius, spin: O.spin, launchSpeed: O.launchSpeed, range: w.projectile.range };
      q.range = Infinity;
      q.hitTimes = new Map();
    }
    fireCooldown(world, p, w);
    emitShoot(world, p, w);
  }
};
