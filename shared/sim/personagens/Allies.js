import { spawnProjectile } from '../armas/Projectiles.js';
import { damageEnemy, explode } from '../combat.js';

/**
 * Aliados e objetos do time no chão: Planta Carnívora (Vivian), torretas e minas das armas.
 * Cada tipo tem seu update em ALLY_KINDS; para criar um tipo novo, acrescente aqui.
 */
export function createAlly(world, kind, x, y, opts = {}) {
  const a = { id: world.newId(), kind, x, y, r: 12, life: 10, aim: 0, cd: 0.3, ownerId: null, dead: false, t: 0, ...opts };
  a.maxLife = a.life;
  world.allies.push(a);
  return a;
}

export function countAllies(world, ownerId, kind) {
  return world.allies.filter((a) => !a.dead && a.ownerId === ownerId && a.kind === kind).length;
}

/** Inimigo vivo mais próximo (com linha de visão) dentro de range. */
function nearestEnemy(world, a, range) {
  let best = null, bd = range;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
    const d = Math.hypot(e.x - a.x, e.y - a.y);
    if (d < bd && world.map.lineOfSight(a.x, a.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}

export const ALLY_KINDS = {
  /** Planta Carnívora: morde quem chega perto, cospe sementes em quem está longe. */
  planta: {
    update(world, a, dt, owner) {
      const t = nearestEnemy(world, a, 190);
      a.aim = t ? Math.atan2(t.e.y - a.y, t.e.x - a.x) : a.aim;
      a.cd -= dt;
      a.biteCd = (a.biteCd || 0) - dt;
      if (t && t.d < 36 && a.biteCd <= 0) {
        a.biteCd = 0.7;
        damageEnemy(world, t.e, 7, { source: owner, noMul: true, knockback: 120, angle: a.aim });
        world.emit('bite', { x: t.e.x, y: t.e.y });
      } else if (t && a.cd <= 0) {
        a.cd = 0.55;
        spawnProjectile(world, { team: 'player', owner, x: a.x, y: a.y - 8, angle: a.aim, speed: 420, radius: 5, damage: 4, range: 260, sprite: 'proj_semente' });
      }
    }
  },
  /** Torreta (arma deploy): atira sozinha no inimigo mais próximo. */
  turret: {
    update(world, a, dt, owner) {
      a.cd -= dt;
      const t = nearestEnemy(world, a, a.range);
      if (t) a.aim = Math.atan2(t.e.y - a.y, t.e.x - a.x);
      if (t && a.cd <= 0) {
        a.cd = 1 / a.fireRate;
        spawnProjectile(world, { team: 'player', owner, x: a.x, y: a.y - 8, angle: a.aim, speed: 480, radius: 4, damage: a.damage, range: a.range + 40, sprite: a.sprite });
        world.emit('turret_shoot', { x: a.x, y: a.y });
      }
    }
  },
  /** Mina (arma deploy): arma em 0,5 s e explode quando um inimigo encosta. */
  mine: {
    update(world, a, dt, owner) {
      a.armed = a.t >= 0.5;
      if (!a.armed) return;
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || e.def.flying) continue;
        if (Math.hypot(e.x - a.x, e.y - a.y) > a.triggerRadius + e.r) continue;
        a.dead = true;
        explode(world, a.x, a.y, a.radius, a.damage, { source: owner, style: 'barrel' });
        return;
      }
    }
  }
};

export function updateAllies(world, dt) {
  for (const a of world.allies) {
    if (a.dead) continue;
    a.life -= dt;
    a.t += dt;
    if (a.life <= 0) { a.dead = true; world.emit('ally_end', { x: a.x, y: a.y, kind: a.kind }); continue; }
    const owner = world.players.find((p) => p.id === a.ownerId) || null;
    ALLY_KINDS[a.kind]?.update(world, a, dt, owner);
  }
}
