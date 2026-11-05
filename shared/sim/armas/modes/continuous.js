import { DEG } from '../../math.js';
import { damageEnemy } from '../../combat.js';
import { damageProp, propAt } from '../../salas/Props.js';
import { spawnShot } from '../shots.js';
import { tryPay, startCooldown, emitShoot, critChanceOf } from '../common.js';

/** Modos contínuos acertam muitas vezes por segundo: crítico e efeito com metade da chance. */
const CONT_MUL = 0.5;

function halfEffect(w) {
  return w.effect ? { ...w.effect, chance: (w.effect.chance ?? 1) * CONT_MUL } : null;
}

/** Laser contínuo: raio da arma até a parede (ou o primeiro inimigo), dano por tique, energia por segundo. */
export const beam = {
  hold(world, p, w, dt) {
    const b = w.beam;
    const ws = p.wstate;
    const perSec = b.energyPerSec * p.mods.energyCostMul;
    if (perSec > 0) {
      if (p.energy < 1) { tryPay(world, p, w, 1); return; }
      ws.beamAcc += perSec * dt;
      while (ws.beamAcc >= 1) {
        if (!tryPay(world, p, w, 1)) { ws.beamAcc = 0; return; }
        ws.beamAcc -= 1;
      }
    }
    const a = p.aim, cx = Math.cos(a), cy = Math.sin(a);
    const x1 = p.x + cx * 18, y1 = p.y + cy * 18 - 4;
    let len = b.ghost ? b.range : world.map.raycast(x1, y1, a, b.range).dist;
    const half = b.width / 2;
    const hits = [];
    for (const e of world.enemies) {
      if (e.dead || e.spawning > 0 || e.def.invulnerable) continue;
      const t = (e.x - x1) * cx + (e.y - y1) * cy;
      if (t < 0 || t > len + e.r) continue;
      const perp = Math.abs((e.x - x1) * -cy + (e.y - y1) * cx);
      if (perp < e.r + half) hits.push({ e, t });
    }
    hits.sort((m, n) => m.t - n.t);
    let targets = hits;
    if (!b.pierce && hits.length) { targets = [hits[0]]; len = Math.max(0, hits[0].t - hits[0].e.r * 0.5); }
    const x2 = x1 + cx * len, y2 = y1 + cy * len;
    ws.beamT -= dt;
    if (ws.beamT <= 0) {
      ws.beamT += b.tick;
      const crit = critChanceOf(p, w) * CONT_MUL;
      for (const { e } of targets) {
        damageEnemy(world, e, b.dps * b.tick, { crit: world.rng.chance(crit), source: p, effect: halfEffect(w), knockback: p.mods.knockback * 0.2, angle: a, carry: 'beam' + p.id });
      }
      if (!targets.length || b.pierce) {
        const prop = propAt(world, x2 + cx * 6, y2 + cy * 6);
        if (prop) damageProp(world, prop.tx, prop.ty, b.dps * b.tick);
      }
      emitShoot(world, p, w);
    }
    world.beams.push({ ownerId: p.id, x1, y1, x2, y2, width: b.width, color: w.projectile.sprite.color });
  },
  idle(world, p) {
    p.wstate.beamT = 0; // ao apertar de novo, o primeiro tique sai na hora
  }
};

/** Lança-chamas: cone curto de partículas que atravessam inimigos (não paredes). */
export const flame = {
  hold(world, p, w) {
    if (p.fireCd > 0 || !tryPay(world, p, w)) return;
    const f = w.flame;
    const proj = { ...w.projectile, speed: f.range / 0.35, range: f.range, pierce: 99, count: 1, spread: 0, bounce: 0, homing: 0, boomerang: false };
    for (let i = 0; i < f.particles; i++) {
      spawnShot(world, p, w, { proj, angle: p.aim + world.rng.range(-f.arc / 2, f.arc / 2) * DEG, inaccuracy: 0, critMul: CONT_MUL, effect: halfEffect(w) });
    }
    startCooldown(p, w);
    emitShoot(world, p, w);
  }
};
