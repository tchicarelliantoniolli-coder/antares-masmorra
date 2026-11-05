import { DEG } from '../math.js';
import { spawnProjectile } from './Projectiles.js';
import { critChanceOf } from './common.js';

/**
 * Cria os projéteis de um disparo (leque, imprecisão, sinais, crítico, efeito, empurrão).
 * opts: { angle, proj, damageMul, speedMul, extraPierce, countOverride, critMul }
 */
export function spawnShot(world, p, w, opts = {}) {
  const { angle = p.aim, proj = w.projectile, damageMul = 1, speedMul = 1, extraPierce = 0, countOverride, critMul = 1 } = opts;
  const pr = proj;
  const count = countOverride ?? pr.count;
  const spread = count > 1 && pr.spread === 0 && countOverride ? 24 : pr.spread;
  const muzzle = 18;
  const sx = p.x + Math.cos(p.aim) * muzzle;
  const sy = p.y + Math.sin(p.aim) * muzzle - 4;
  const critChance = critChanceOf(p, w) * critMul;
  const glyphs = pr.glyphs ? [...pr.glyphs] : null;
  const out = [];
  for (let i = 0; i < count; i++) {
    let a = angle;
    if (count > 1) a += (-spread / 2 + (spread * i) / (count - 1)) * DEG;
    a += world.rng.range(-w.inaccuracy, w.inaccuracy) * DEG;
    let damage = w.damage * damageMul * (pr.damageMul ?? 1);
    let glyph = null;
    let crit = world.rng.chance(critChance);
    if (glyphs) {
      glyph = glyphs[world.rng.int(0, glyphs.length - 1)];
      if (pr.glyphBonus?.[glyph]) damage *= pr.glyphBonus[glyph];
      if (p.mods.vowelCrit && 'AEIOU'.includes(glyph)) crit = true; // passivo Spelling Bee (Marina)
    }
    const split = w.mode === 'split' || (pr.glyphSplit && glyph === pr.glyphSplit) ? (w.split || { into: 2, childDamageMul: 0.5, spread: 50 }) : null;
    out.push(spawnProjectile(world, {
      team: 'player', owner: p,
      x: sx, y: sy, angle: a,
      speed: pr.speed * speedMul * world.rng.range(0.95, 1.05),
      radius: pr.radius, damage, crit,
      range: pr.range, pierce: pr.pierce + extraPierce, bounce: pr.bounce,
      homing: pr.homing, boomerang: pr.boomerang, spin: pr.spin,
      explode: pr.explode, explodeOnExpire: pr.explodeOnExpire,
      ghost: pr.ghost,
      effect: w.effect || null,
      knockback: p.mods.knockback,
      sprite: pr.spriteKey || 'proj_' + w.id, glyph,
      split, singularity: w.mode === 'singularity' ? w.singularity : null, pool: pr.pool || null,
      growOnReturn: pr.growOnReturn
    }));
  }
  return out;
}
