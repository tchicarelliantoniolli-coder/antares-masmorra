import { DEG, angleDiff } from '../math.js';
import { spawnProjectile } from './Projectiles.js';
import { damageEnemy } from '../combat.js';
import { damageProp } from '../salas/Props.js';
import { TILE, T } from '../constants.js';

/** Custo de energia real (com passivos). */
export function energyCost(p, w) {
  return w.energyCost * p.mods.energyCostMul;
}

/** Tenta disparar a arma atual do jogador. Retorna true se disparou. */
export function fireWeapon(world, p) {
  const w = world.data.weapon(p.weapons[p.cur]);
  const cost = energyCost(p, w);
  if (p.energy < cost) {
    if (p.noEnergyCd <= 0) {
      world.emit('no_energy', { playerId: p.id, x: p.x, y: p.y });
      p.noEnergyCd = 0.6;
    }
    return false;
  }
  p.energy -= cost;
  p.fireCd = 1 / (w.fireRate * p.mods.fireRateMul * (p.buffs.hasteTimer > 0 ? 1.6 : 1));
  world.stats.shots++;
  const critChance = w.critChance + p.mods.critBonus;

  if (w.type === 'melee') {
    meleeSwing(world, p, w, critChance);
  } else {
    const pr = w.projectile;
    const muzzle = 18;
    const sx = p.x + Math.cos(p.aim) * muzzle;
    const sy = p.y + Math.sin(p.aim) * muzzle - 4;
    for (let i = 0; i < pr.count; i++) {
      let a = p.aim;
      if (pr.count > 1) a += (-pr.spread / 2 + (pr.spread * i) / (pr.count - 1)) * DEG;
      a += world.rng.range(-w.inaccuracy, w.inaccuracy) * DEG;
      let damage = w.damage;
      let glyph = null;
      let crit = world.rng.chance(critChance);
      if (pr.glyphs) {
        glyph = [...pr.glyphs][world.rng.int(0, [...pr.glyphs].length - 1)];
        if (pr.glyphBonus?.[glyph]) damage *= pr.glyphBonus[glyph];
        if (p.mods.vowelCrit && 'AEIOU'.includes(glyph)) crit = true; // passivo Spelling Bee (Marina)
      }
      spawnProjectile(world, {
        team: 'player', owner: p,
        x: sx, y: sy, angle: a,
        speed: pr.speed * world.rng.range(0.95, 1.05),
        radius: pr.radius, damage, crit,
        range: pr.range, pierce: pr.pierce, bounce: pr.bounce,
        homing: pr.homing, boomerang: pr.boomerang, spin: pr.spin,
        explode: pr.explode, explodeOnExpire: pr.explodeOnExpire,
        effect: rollEffect(world, p, w),
        knockback: p.mods.knockback,
        sprite: 'proj_' + w.id, glyph
      });
    }
  }
  if (p.mods.doubleShot && w.type !== 'melee' && world.rng.chance(p.mods.doubleShot)) p.fireCd *= 0.35;
  world.emit('shoot', { playerId: p.id, weaponId: w.id, category: w.category, wtype: w.type, x: p.x, y: p.y, angle: p.aim });
  return true;
}

function rollEffect(world, p, w) {
  return w.effect || null;
}

/** Ataque corpo a corpo: acerta todos no arco e corta/rebate balas. */
function meleeSwing(world, p, w, critChance) {
  const m = w.melee;
  const reach = m.range;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > reach + e.r) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    if (d > e.r + 6 && Math.abs(angleDiff(p.aim, a)) > (m.arc / 2) * DEG) continue;
    damageEnemy(world, e, w.damage, {
      crit: world.rng.chance(critChance), source: p, effect: w.effect,
      knockback: m.knockback, angle: a
    });
  }
  // caixas e barris no alcance do golpe
  const map = world.map;
  const tr = Math.ceil(reach / TILE) + 1;
  const ptx = Math.floor(p.x / TILE), pty = Math.floor(p.y / TILE);
  for (let ty = pty - tr; ty <= pty + tr; ty++) for (let tx = ptx - tr; tx <= ptx + tr; tx++) {
    if (map.get(tx, ty) !== T.PROP) continue;
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d > reach + 16) continue;
    if (d > 24 && Math.abs(angleDiff(p.aim, Math.atan2(cy - p.y, cx - p.x))) > (m.arc / 2) * DEG) continue;
    damageProp(world, tx, ty, w.damage);
  }
  if (m.deflect) {
    for (const q of world.projectiles) {
      if (q.team !== 'enemy' || q.dead) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d > reach + 8) continue;
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      if (Math.abs(angleDiff(p.aim, a)) > (m.arc / 2 + 10) * DEG) continue;
      if (m.reflect) {
        q.team = 'player';
        q.owner = p;
        q.damage = Math.max(2, q.damage * 3);
        q.vx = Math.cos(p.aim) * q.speed * 1.4;
        q.vy = Math.sin(p.aim) * q.speed * 1.4;
        q.traveled = 0;
        q.range = 500;
        q.hit = new Set();
        world.emit('reflect', { x: q.x, y: q.y });
      } else {
        q.dead = true;
        world.emit('deflect', { x: q.x, y: q.y });
      }
    }
  }
  world.emit('swing', { playerId: p.id, x: p.x, y: p.y, angle: p.aim, arc: m.arc, range: reach, weaponId: w.id });
}
