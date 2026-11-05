import { hurtPlayer, damageEnemy } from './combat.js';
import { damagePropsInRadius } from './salas/Props.js';

/** Áreas no chão: avisos de ataque, poças de toner, campo gravitacional, círculo da conversa, cela... */
export function createArea(world, kind, x, y, opts = {}) {
  const a = { id: world.newId(), kind, x, y, r: opts.r ?? 40, t: 0, life: opts.life ?? 1, dead: false, tick: 0, ...opts };
  world.areas.push(a);
  return a;
}

export function updateAreas(world, dt) {
  for (const a of world.areas) {
    if (a.dead) continue;
    a.t += dt;
    switch (a.kind) {
      case 'toner_puddle':
        for (const p of world.players) {
          if (p.dead || p.downed || p.mods.tonerImmune) continue;
          if (Math.hypot(p.x - a.x, p.y - a.y) < a.r) p.slowTimer = Math.max(p.slowTimer, 0.15);
        }
        break;
      case 'gravity':
      case 'singularity': {
        // Campo Gravitacional (Jean Paulo) e buraco negro das armas: puxa inimigos para o centro e causa dano
        a.tick += dt;
        const owner = world.players.find((p) => p.id === a.ownerId);
        const pullBase = a.pull ?? 190, dps = a.dps ?? 6;
        for (const e of world.enemies) {
          if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
          const d = Math.hypot(e.x - a.x, e.y - a.y);
          if (d > a.r) continue;
          if (a.tick >= 0.5) damageEnemy(world, e, dps * 0.5, { source: owner, noMul: true, carry: 'grav' + a.id });
          if (d < 4) continue;
          const pull = (e.def.boss ? pullBase * 0.16 : pullBase) * dt;
          world.map.moveBox(e, ((a.x - e.x) / d) * Math.min(pull, d), ((a.y - e.y) / d) * Math.min(pull, d));
        }
        if (a.tick >= 0.5) a.tick = 0;
        break;
      }
      case 'private_circle': {
        // Conversa Particular (Katia): o alvo não sai do círculo e ninguém entra
        for (const p of world.players) {
          if (p.dead || p.jailTimer > 0) continue;
          const d = Math.hypot(p.x - a.x, p.y - a.y) || 0.01;
          if (p.id === a.targetId) {
            const max = a.r - p.r;
            if (d > max) { p.x = a.x + ((p.x - a.x) / d) * max; p.y = a.y + ((p.y - a.y) / d) * max; }
          } else {
            const min = a.r + p.r;
            if (d < min) world.map.moveBox(p, ((p.x - a.x) / d) * (min - d), ((p.y - a.y) / d) * (min - d));
          }
        }
        break;
      }
      case 'pool': {
        // poça das armas (tinta, ácido, fogo...): machuca e aplica efeito a cada 0,5 s; pode deixar lento
        a.tick += dt;
        const owner = world.players.find((p) => p.id === a.ownerId) || null;
        const pulse = a.tick >= 0.5;
        for (const e of world.enemies) {
          if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
          if (Math.hypot(e.x - a.x, e.y - a.y) > a.r + e.r * 0.5) continue;
          if (a.slowMul < 1) { e.status.slow = Math.max(e.status.slow || 0, 0.3); e.status.slowMul = Math.min(e.status.slowMul ?? 1, a.slowMul); }
          if (!pulse || a.dps <= 0) continue;
          // poças da mesma arma/dono não somam: cada inimigo leva no máximo um pulso por dono e estilo
          const key = a.ownerId + ':' + a.style;
          e.poolHits = e.poolHits || {};
          if (world.time - (e.poolHits[key] ?? -1) < 0.45) continue;
          e.poolHits[key] = world.time;
          damageEnemy(world, e, a.dps * 0.5, { source: owner, noMul: true, effect: a.effect, carry: 'pool' + key });
        }
        if (pulse) a.tick = 0;
        break;
      }
      default:
        break;
    }
    if (a.t >= a.life) {
      a.dead = true;
      if (a.kind === 'rain_mark') {
        const owner = world.players.find((p) => p.id === a.ownerId) || null;
        for (const e of world.enemies) {
          if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
          if (Math.hypot(e.x - a.x, e.y - a.y) > a.r + e.r) continue;
          damageEnemy(world, e, a.damage, { crit: a.crit, source: owner, effect: a.effect });
        }
        damagePropsInRadius(world, a.x, a.y, a.r, a.damage);
        world.emit('proj_hit', { x: a.x, y: a.y, team: 'player', style: a.sprite });
      }
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
