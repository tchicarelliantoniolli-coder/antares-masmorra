import { damageEnemy, explode, hurtPlayer } from '../combat.js';
import { angleDiff } from '../math.js';

/**
 * Cria um projétil.
 * team: 'player' | 'enemy'
 */
export function spawnProjectile(world, o) {
  const p = {
    id: world.newId(),
    team: o.team,
    x: o.x, y: o.y,
    vx: Math.cos(o.angle) * o.speed,
    vy: Math.sin(o.angle) * o.speed,
    speed: o.speed,
    r: o.radius ?? 5,
    damage: o.damage ?? 1,
    crit: !!o.crit,
    range: o.range ?? 600,
    traveled: 0,
    pierce: o.pierce ?? 0,
    bounce: o.bounce ?? 0,
    homing: o.homing ?? 0,
    boomerang: !!o.boomerang,
    returning: false,
    spin: o.spin ?? 0,
    ghost: !!o.ghost,              // atravessa paredes
    deflects: !!o.deflects,        // apaga projéteis inimigos que encostar
    explodeDef: o.explode || null,
    explodeOnExpire: !!o.explodeOnExpire,
    effect: o.effect || null,
    knockback: o.knockback || 0,
    owner: o.owner || null,        // jogador dono (para buffs/estatísticas)
    sprite: o.sprite,              // chave de textura para o renderizador
    glyph: o.glyph || null,
    style: o.style || null,        // estilo de bala inimiga
    slow: o.slow || 0,             // lentidão aplicada ao jogador (balas inimigas)
    hit: new Set(),
    dead: false,
    age: 0
  };
  world.projectiles.push(p);
  return p;
}

function impact(world, p) {
  if (p.dead) return;
  p.dead = true;
  if (p.explodeDef) {
    explode(world, p.x, p.y, p.explodeDef.radius, p.explodeDef.damage, {
      source: p.owner, effect: p.effect, style: p.sprite?.includes('acido') || p.effect?.type === 'veneno' ? 'acid' : 'chalk'
    });
  } else {
    world.emit('proj_hit', { x: p.x, y: p.y, team: p.team, style: p.style || p.sprite });
  }
}

export function updateProjectiles(world, dt) {
  const map = world.map;
  for (const p of world.projectiles) {
    if (p.dead) continue;
    p.age += dt;

    // Teleguiado
    if (p.homing && p.team === 'player') {
      let best = null, bd = 260;
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const cur = Math.atan2(p.vy, p.vx);
        const want = Math.atan2(best.y - p.y, best.x - p.x);
        const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, angleDiff(cur, want)));
        const a = cur + turn;
        p.vx = Math.cos(a) * p.speed;
        p.vy = Math.sin(a) * p.speed;
      }
    }

    // Bumerangue: na metade do alcance, volta para o dono
    if (p.boomerang) {
      if (!p.returning && p.traveled >= p.range) { p.returning = true; p.hit.clear(); }
      if (p.returning && p.owner) {
        const a = Math.atan2(p.owner.y - p.y, p.owner.x - p.x);
        p.vx = Math.cos(a) * p.speed * 1.1;
        p.vy = Math.sin(a) * p.speed * 1.1;
        if (Math.hypot(p.owner.x - p.x, p.owner.y - p.y) < 16) { p.dead = true; continue; }
      }
    }

    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    if (!p.ghost && map.solidAt(nx, ny)) {
      if (p.boomerang) {
        p.returning = true;
      } else if (p.bounce > 0) {
        p.bounce--;
        if (map.solidAt(nx, p.y)) p.vx = -p.vx;
        if (map.solidAt(p.x, ny)) p.vy = -p.vy;
        if (!map.solidAt(nx, p.y) && !map.solidAt(p.x, ny)) { p.vx = -p.vx; p.vy = -p.vy; }
        world.emit('bounce', { x: p.x, y: p.y });
        continue;
      } else {
        impact(world, p);
        continue;
      }
    }
    p.x = nx; p.y = ny;
    p.traveled += p.speed * dt;

    if (p.team === 'player') {
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || p.hit.has(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r) continue;
        p.hit.add(e.id);
        if (p.explodeDef) { impact(world, p); break; }
        damageEnemy(world, e, p.damage, {
          crit: p.crit, source: p.owner, effect: p.effect,
          knockback: p.knockback, angle: Math.atan2(p.vy, p.vx)
        });
        if (p.pierce > 0) {
          p.pierce--;
        } else {
          impact(world, p);
          break;
        }
      }
      if (p.deflects) {
        for (const q of world.projectiles) {
          if (q.team === 'enemy' && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < p.r + q.r) {
            q.dead = true;
            world.emit('deflect', { x: q.x, y: q.y });
          }
        }
      }
    } else {
      for (const pl of world.players) {
        if (pl.dead || pl.downed) continue;
        if (Math.hypot(pl.x - p.x, pl.y - p.y) > pl.r + p.r - 2) continue;
        if (pl.invuln > 0) continue;
        hurtPlayer(world, pl, p.damage, { slow: p.slow });
        impact(world, p);
        break;
      }
    }

    if (!p.dead && !p.boomerang && p.traveled >= p.range) {
      if (p.explodeOnExpire) impact(world, p);
      else { p.dead = true; world.emit('proj_fade', { x: p.x, y: p.y, style: p.style || p.sprite }); }
    }
    if (p.boomerang && p.traveled > p.range * 4) p.dead = true;
  }
}
