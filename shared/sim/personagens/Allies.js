import { spawnProjectile } from '../armas/Projectiles.js';
import { damageEnemy } from '../combat.js';

/** Aliados temporários (por enquanto: Planta Carnívora da Vivian). */
export function updateAllies(world, dt) {
  for (const a of world.allies) {
    if (a.dead) continue;
    a.life -= dt;
    if (a.life <= 0) { a.dead = true; world.emit('ally_end', { x: a.x, y: a.y }); continue; }
    const owner = world.players.find((p) => p.id === a.ownerId) || null;
    let best = null, bd = 190;
    for (const e of world.enemies) {
      if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
      const d = Math.hypot(e.x - a.x, e.y - a.y);
      if (d < bd && world.map.lineOfSight(a.x, a.y, e.x, e.y)) { bd = d; best = e; }
    }
    a.aim = best ? Math.atan2(best.y - a.y, best.x - a.x) : a.aim || 0;
    a.cd -= dt;
    a.biteCd -= dt;
    if (best && bd < 36 && a.biteCd <= 0) {
      a.biteCd = 0.7;
      damageEnemy(world, best, 7, { source: owner, noMul: true, knockback: 120, angle: a.aim });
      world.emit('bite', { x: best.x, y: best.y });
    } else if (best && a.cd <= 0) {
      a.cd = 0.55;
      spawnProjectile(world, {
        team: 'player', owner, x: a.x, y: a.y - 8, angle: a.aim, speed: 420, radius: 5,
        damage: 4, range: 260, sprite: 'proj_semente'
      });
    }
  }
}
