import { hurtPlayer } from './combat.js';

/** Áreas no chão: avisos de ataque, poças de toner, etc. */
export function createArea(world, kind, x, y, opts = {}) {
  const a = { id: world.newId(), kind, x, y, r: opts.r ?? 40, t: 0, life: opts.life ?? 1, dead: false, ...opts };
  world.areas.push(a);
  return a;
}

export function updateAreas(world, dt) {
  for (const a of world.areas) {
    if (a.dead) continue;
    a.t += dt;
    if (a.kind === 'toner_puddle') {
      for (const p of world.players) {
        if (p.dead || p.downed || p.mods.tonerImmune) continue;
        if (Math.hypot(p.x - a.x, p.y - a.y) < a.r) p.slowTimer = Math.max(p.slowTimer, 0.15);
      }
    }
    if (a.t >= a.life) {
      a.dead = true;
      if (a.kind === 'toner_warning') {
        world.emit('toner_splash', { x: a.x, y: a.y, r: a.r });
        for (const p of world.players) {
          if (Math.hypot(p.x - a.x, p.y - a.y) < a.r + p.r * 0.5) hurtPlayer(world, p, 1, { slow: 1 });
        }
        createArea(world, 'toner_puddle', a.x, a.y, { r: a.r, life: 5 });
      }
    }
  }
}
