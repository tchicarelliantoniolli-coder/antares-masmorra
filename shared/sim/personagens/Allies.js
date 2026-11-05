import { spawnProjectile } from '../armas/Projectiles.js';
import { damageEnemy, explode } from '../combat.js';

/**
 * Aliados e objetos do time no chão: Planta Carnívora (Vivian), torretas e minas das armas.
 * Aliado com hp pode ser ferido pelos inimigos (hurtAlly); com taunt eles passam a mirar nele.
 * Cada tipo tem seu update em ALLY_KINDS (defaults = hp/taunt/vida padrão do tipo); para criar um tipo novo, acrescente aqui.
 */
export function createAlly(world, kind, x, y, opts = {}) {
  const a = { id: world.newId(), kind, x, y, r: 12, life: 10, aim: 0, cd: 0.3, ownerId: null, dead: false, t: 0, ...ALLY_KINDS[kind]?.defaults, ...opts };
  a.maxLife = a.life;
  if (a.hp > 0) a.maxHp = a.hp; // sem hp = indestrutível (mina)
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
    if (e.dead || e.spawning > 0 || e.burrowed || e.def.invulnerable) continue;
    const d = Math.hypot(e.x - a.x, e.y - a.y);
    if (d < bd && world.map.lineOfSight(a.x, a.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best ? { e: best, d: bd } : null;
}

/** Anda até (tx, ty) na velocidade dada; devolve true se andou. */
function walkTo(world, a, tx, ty, speed, dt) {
  const ang = Math.atan2(ty - a.y, tx - a.x);
  a.aim = ang;
  const r = world.map.moveBox(a, Math.cos(ang) * speed * dt, Math.sin(ang) * speed * dt);
  return !(r.hitX && r.hitY);
}

/** Corpo a corpo: persegue o inimigo mais perto e bate quando encosta. */
function melee(world, a, dt, owner, { speed, damage, every }) {
  a.cd -= dt;
  const t = nearestEnemy(world, a, 420);
  if (!t) return;
  if (t.d > a.r + t.e.r + 6) { walkTo(world, a, t.e.x, t.e.y, speed, dt); return; }
  a.aim = Math.atan2(t.e.y - a.y, t.e.x - a.x);
  if (a.cd <= 0) {
    a.cd = every;
    damageEnemy(world, t.e, damage, { source: owner, noMul: true, knockback: 100, angle: a.aim });
    world.emit('bite', { x: t.e.x, y: t.e.y });
  }
}

/** Atirador que mantém distância: recua se o inimigo chega perto, avança se está longe. */
function shooter(world, a, dt, owner, { speed, near, range, damage, every, effect }) {
  a.cd -= dt;
  const t = nearestEnemy(world, a, range);
  if (!t) return;
  a.aim = Math.atan2(t.e.y - a.y, t.e.x - a.x);
  if (t.d < near) walkTo(world, a, a.x - Math.cos(a.aim) * 50, a.y - Math.sin(a.aim) * 50, speed, dt);
  a.aim = Math.atan2(t.e.y - a.y, t.e.x - a.x);
  if (a.cd <= 0) {
    a.cd = every;
    spawnProjectile(world, { team: 'player', owner, x: a.x, y: a.y - 8, angle: a.aim, speed: 420, radius: 5, damage, range: range + 20, effect, sprite: 'proj_semente' });
  }
}

export const ALLY_KINDS = {
  /** Planta Carnívora: morde quem chega perto, cospe sementes em quem está longe. */
  planta: {
    defaults: { hp: 15, taunt: true },
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
    defaults: { hp: 20, taunt: true },
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

Object.assign(ALLY_KINDS, {
  /** Legionário: anda até o inimigo mais perto e golpeia. */
  legionario: {
    defaults: { hp: 30, taunt: true },
    update(world, a, dt, owner) { melee(world, a, dt, owner, { speed: 110, damage: 6, every: 0.8 }); }
  },
  /** Cavaleiro: investe em linha reta (sem aviso) contra o inimigo mais perto, ferindo quem atravessa. */
  cavaleiro: {
    defaults: { hp: 22, taunt: true },
    update(world, a, dt, owner) {
      a.cd -= dt;
      if (a.charging) {
        const step = 420 * dt;
        const r = world.map.moveBox(a, Math.cos(a.aim) * step, Math.sin(a.aim) * step);
        a.traveled += step;
        for (const e of world.enemies) {
          if (e.dead || e.spawning > 0 || e.burrowed || e.def.invulnerable || a.hitIds.has(e.id)) continue;
          if (Math.hypot(e.x - a.x, e.y - a.y) > a.r + e.r) continue;
          a.hitIds.add(e.id);
          damageEnemy(world, e, 8, { source: owner, noMul: true, knockback: 180, angle: a.aim });
        }
        if (r.hitX || r.hitY || a.traveled >= 280) { a.charging = false; a.cd = 2; }
        return;
      }
      const t = nearestEnemy(world, a, 320);
      if (!t) return;
      a.aim = Math.atan2(t.e.y - a.y, t.e.x - a.x);
      if (a.cd <= 0) { a.charging = true; a.traveled = 0; a.hitIds = new Set(); }
      else if (t.d > 90) walkTo(world, a, t.e.x, t.e.y, 90, dt);
    }
  },
  /** Bandeirante: fica atrás e atira. */
  bandeirante: {
    defaults: { hp: 16, taunt: true },
    update(world, a, dt, owner) { shooter(world, a, dt, owner, { speed: 100, near: 140, range: 260, damage: 4, every: 0.5 }); }
  },
  /** Capitu: atira e cada acerto deixa o inimigo lento por 1,5 s. */
  capitu: {
    defaults: { hp: 16, taunt: true },
    update(world, a, dt, owner) {
      shooter(world, a, dt, owner, { speed: 100, near: 120, range: 240, damage: 3, every: 0.5, effect: { type: 'gelo', duration: 1.5, power: 0.5 } });
    }
  },
  /** Macunaíma: rápido, corpo a corpo. */
  macunaima: {
    defaults: { hp: 18, taunt: true },
    update(world, a, dt, owner) { melee(world, a, dt, owner, { speed: 220, damage: 5, every: 0.5 }); }
  },
  /** Policarpo: parado, atira um leque de 5. */
  policarpo: {
    defaults: { hp: 26, taunt: true },
    update(world, a, dt, owner) {
      a.cd -= dt;
      const t = nearestEnemy(world, a, 240);
      if (!t) return;
      a.aim = Math.atan2(t.e.y - a.y, t.e.x - a.x);
      if (a.cd > 0) return;
      a.cd = 1.2;
      for (let i = -2; i <= 2; i++) {
        spawnProjectile(world, { team: 'player', owner, x: a.x, y: a.y - 8, angle: a.aim + i * 0.22, speed: 400, radius: 4, damage: 3, range: 240, sprite: 'proj_semente' });
      }
    }
  }
});

export function updateAllies(world, dt) {
  for (const a of world.allies) {
    if (a.dead) continue;
    a.life -= dt;
    a.t += dt;
    if (a.life <= 0) { a.dead = true; world.emit('ally_end', { x: a.x, y: a.y, kind: a.kind }); continue; }
    const owner = world.players.find((p) => p.id === a.ownerId) || null;
    if (a.ownerId != null && (!owner || owner.dead)) { a.dead = true; world.emit('ally_end', { x: a.x, y: a.y, kind: a.kind }); continue; }
    ALLY_KINDS[a.kind]?.update(world, a, dt, owner);
  }
}
