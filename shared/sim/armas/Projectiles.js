import { damageEnemy, explode, hurtPlayer } from '../combat.js';
import { angleDiff } from '../math.js';
import { propAt, damageProp } from '../salas/Props.js';
import { createArea } from '../areas.js';
import { shieldBlocks } from './melee.js';

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
    split: o.split || null,        // divide-se ao bater (modo split)
    child: !!o.child,              // filho de uma divisão (não divide de novo)
    singularity: o.singularity || null, // vira buraco negro ao bater
    pool: o.pool || null,          // deixa poça ao bater
    growOnReturn: o.growOnReturn ?? 1,  // bumerangue cresce na volta
    lob: null,                     // arremesso em arco (modo lob): { sx, sy, tx, ty, t, flight, peak, ... }
    z: 0,                          // altura do arremesso (só visual)
    orbit: null,                   // girando em volta do dono (modo orbit)
    hit: new Set(),
    dead: false,
    age: 0
  };
  world.projectiles.push(p);
  return p;
}

/** Divide o projétil em filhos menores, saindo na direção "angle". */
function splitInto(world, p, angle) {
  const sp = p.split;
  const n = sp.into;
  const x = p.x + Math.cos(angle) * 6, y = p.y + Math.sin(angle) * 6; // um pouco para fora da parede/inimigo
  for (let i = 0; i < n; i++) {
    const a = angle + (n > 1 ? (-sp.spread / 2 + (sp.spread * i) / (n - 1)) * (Math.PI / 180) : 0);
    const c = spawnProjectile(world, {
      team: p.team, owner: p.owner, x, y, angle: a, speed: p.speed, radius: Math.max(3, p.r * 0.7),
      damage: p.damage * sp.childDamageMul, crit: p.crit, range: Math.max(120, (p.range - p.traveled) * 0.6),
      effect: p.effect, knockback: p.knockback, sprite: p.sprite, glyph: p.glyph, child: true
    });
    c.hit = new Set(p.hit);
  }
  world.emit('split', { x: p.x, y: p.y });
}

/** Fim do projétil: explode, divide, vira buraco negro ou só some com faísca. angle = direção de saída dos filhos. */
function impact(world, p, angle = Math.atan2(p.vy, p.vx)) {
  if (p.dead) return;
  p.dead = true;
  if (p.split && !p.child) splitInto(world, p, angle);
  if (p.singularity) {
    const s = p.singularity;
    createArea(world, 'singularity', p.x, p.y, { r: s.pullRadius, life: s.life, dps: s.dps, pull: s.pull, ownerId: p.owner?.id });
  }
  if (p.pool) createArea(world, 'pool', p.x, p.y, { ...p.pool, ownerId: p.owner?.id });
  if (p.explodeDef) {
    explode(world, p.x, p.y, p.explodeDef.radius, p.explodeDef.damage, {
      source: p.owner, effect: p.effect, style: p.effect?.type === 'veneno' ? 'acid' : (p.explodeDef.style || 'chalk'),
      hurtsPlayers: p.team === 'enemy', playerDamage: p.damage
    });
  } else {
    world.emit('proj_hit', { x: p.x, y: p.y, team: p.team, style: p.style || p.sprite });
  }
}

/** Arremesso em arco: anda do ponto de saída até o alvo por cima de tudo; quica, espera o pavio e cai. */
function updateLob(world, p, dt) {
  const L = p.lob;
  if (L.waiting > 0) {
    L.waiting -= dt;
    if (L.waiting <= 0) land(world, p);
    return;
  }
  L.t += dt;
  const k = Math.min(1, L.t / L.flight);
  p.x = L.sx + (L.tx - L.sx) * k;
  p.y = L.sy + (L.ty - L.sy) * k;
  p.z = 4 * L.peak * k * (1 - k);
  if (k < 1) return;
  if (L.bounces > 0) {
    L.bounces--;
    const a = Math.atan2(L.ty - L.sy, L.tx - L.sx);
    const d = Math.hypot(L.tx - L.sx, L.ty - L.sy) * 0.4;
    const t = world.map.raycast(L.tx, L.ty, a, d);
    Object.assign(L, { sx: L.tx, sy: L.ty, tx: t.x, ty: t.y, t: 0, flight: L.flight * 0.6, peak: L.peak * 0.5 });
    world.emit('bounce', { x: p.x, y: p.y });
    return;
  }
  p.z = 0;
  if (L.fuse > 0) { L.waiting = L.fuse; L.fuse = 0; return; }
  land(world, p);
}

/** O arremesso chega ao chão: sem explosão, acerta quem estiver embaixo. */
function land(world, p) {
  if (!p.explodeDef && p.team === 'player') {
    for (const e of world.enemies) {
      if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r + 8) continue;
      damageEnemy(world, e, p.damage, { crit: p.crit, source: p.owner, effect: p.effect, knockback: p.knockback, angle: Math.atan2(p.vy, p.vx) });
    }
  }
  impact(world, p);
}

/** Projétil em órbita: gira em volta do dono, bate em quem encostar (no máximo a cada 0,5 s) e apaga balas. */
function updateOrbit(world, p, dt) {
  const o = p.orbit;
  const owner = world.players.find((q) => q.id === o.ownerId);
  if (!owner || owner.dead || owner.downed) { p.dead = true; world.emit('proj_fade', { x: p.x, y: p.y, style: p.sprite }); return; }
  o.angle += o.spin * dt;
  const nx = owner.x + Math.cos(o.angle) * o.radius, ny = owner.y - 4 + Math.sin(o.angle) * o.radius;
  p.vx = (nx - p.x) / Math.max(dt, 1e-6); p.vy = (ny - p.y) / Math.max(dt, 1e-6);
  p.x = nx; p.y = ny;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r) continue;
    const last = p.hitTimes.get(e.id);
    if (last !== undefined && world.time - last < 0.5) continue;
    p.hitTimes.set(e.id, world.time);
    damageEnemy(world, e, p.damage, { crit: p.crit, source: p.owner, effect: p.effect, knockback: 80 + p.knockback, angle: o.angle });
  }
  for (const q of world.projectiles) {
    if (q.team === 'enemy' && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < p.r + q.r + 2) {
      q.dead = true;
      world.emit('deflect', { x: q.x, y: q.y });
    }
  }
}

/** Direção refletida ao bater numa parede em (nx, ny). */
function reflectAngle(map, p, nx, ny) {
  let vx = p.vx, vy = p.vy;
  if (map.solidAt(nx, p.y)) vx = -vx;
  if (map.solidAt(p.x, ny)) vy = -vy;
  if (vx === p.vx && vy === p.vy) { vx = -vx; vy = -vy; }
  return Math.atan2(vy, vx);
}

export function updateProjectiles(world, dt) {
  const map = world.map;
  for (const p of world.projectiles) {
    if (p.dead) continue;
    p.age += dt;
    if (p.lob) { updateLob(world, p, dt); continue; }
    if (p.orbit) { updateOrbit(world, p, dt); continue; }

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
      const prop = propAt(world, nx, ny);
      if (prop) {
        damageProp(world, prop.tx, prop.ty, p.team === 'player' ? p.damage : 1);
        if (p.boomerang) { p.returning = true; } else { const ra = reflectAngle(map, p, nx, ny); impact(world, p, ra); continue; }
      }
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
        impact(world, p, reflectAngle(map, p, nx, ny));
        continue;
      }
    }
    p.x = nx; p.y = ny;
    p.traveled += p.speed * dt;

    if (p.team === 'player') {
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || p.hit.has(e.id) || e.def.invulnerable) continue;
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
      // Grammar Shield: bolha de letras apaga as balas inimigas
      let blocked = false;
      for (const pl of world.players) {
        if (pl.buffs?.bubbleTimer > 0 && !pl.downed && Math.hypot(pl.x - p.x, pl.y - p.y) < pl.r + 26) { blocked = true; break; }
      }
      if (blocked) { p.dead = true; world.emit('deflect', { x: p.x, y: p.y }); continue; }
      for (const pl of world.players) {
        if (pl.dead || pl.downed || pl.jailTimer > 0) continue;
        if (Math.hypot(pl.x - p.x, pl.y - p.y) > pl.r + p.r - 2) continue;
        if (shieldBlocks(world, pl, p)) { p.dead = true; break; }
        if (pl.invuln > 0 || pl.dash) continue;
        hurtPlayer(world, pl, p.damage, { slow: p.slow });
        impact(world, p);
        break;
      }
    }

    if (!p.dead && !p.boomerang && p.traveled >= p.range) {
      if (p.explodeOnExpire || p.singularity) impact(world, p);
      else { p.dead = true; world.emit('proj_fade', { x: p.x, y: p.y, style: p.style || p.sprite }); }
    }
    if (p.boomerang && p.traveled > p.range * 4) p.dead = true;
  }
}
