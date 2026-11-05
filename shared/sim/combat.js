import { INVULN_TIME, TILE } from './constants.js';
import { dropEnergy, dropCoins, dropWeapon, createPickup } from './salas/Pickups.js';
import { damagePropsInRadius } from './salas/Props.js';
import { BEHAVIOR_HOOKS } from './inimigos/behaviors.js';
import { AFFIXES } from './inimigos/affixes.js';

/**
 * Dano em inimigo. opts: { crit, source (jogador), effect, knockback, angle, noMul }
 * Retorna o dano aplicado.
 */
export function damageEnemy(world, e, amount, opts = {}) {
  if (e.dead || e.spawning > 0 || e.burrowed) return 0;
  if (e.def.invulnerable || e.shielded > 0) {
    if (e.shieldHit) { e.shielded = 0; e.shieldHit = false; } // escudo do grêmio: vale por 1 golpe
    world.emit('immune', { x: e.x, y: e.y - e.r });
    if (e.affix) AFFIXES[e.affix]?.onDamaged?.(world, e);
    return 0;
  }
  let dmg = amount;
  const src = opts.source;
  if (src && !opts.noMul && src.buffs.nextHitMul > 1) {
    dmg *= src.buffs.nextHitMul;
    world.emit('equation_hit', { x: e.x, y: e.y - 20, mul: src.buffs.nextHitMul, playerId: src.id });
    src.buffs.nextHitMul = 1;
    src.buffs.nextHitTimer = 0;
  }
  if (opts.crit) dmg *= 2;
  if (e.state === 'stunned') dmg *= 2; // tonto (grampeador depois da batida)
  if (src) dmg *= src.mods.damageMul;
  if (opts.carry) {
    // dano contínuo (laser, poça, campo): guarda a fração para o próximo tique em vez de arredondar
    e.dmgCarry = e.dmgCarry || {};
    const total = (e.dmgCarry[opts.carry] || 0) + dmg;
    dmg = Math.floor(total);
    e.dmgCarry[opts.carry] = total - dmg;
    if (dmg < 1) return 0;
  } else dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.flash = 0.1;
  world.stats.damage += dmg;
  if (src) src.damageDealt += dmg;
  world.emit('dmg', { x: e.x, y: e.y - e.r, amount: dmg, crit: !!opts.crit, target: 'enemy', id: e.id });
  // Circuito (Vinícius): metade do dano vai para cada outro inimigo ligado (secundário: não recircula)
  if (e.linked && !opts.noChain && e.linked.until > world.time) {
    const share = (dmg * 0.5) / (src ? src.mods.damageMul : 1); // damageEnemy multiplica pelo damageMul de novo
    for (const o of world.enemies) {
      if (o === e || o.dead || o.linked?.id !== e.linked.id) continue;
      damageEnemy(world, o, share, { source: src, noMul: true, noChain: true });
    }
  }

  if (opts.knockback && !e.def.boss) {
    const kb = opts.knockback / (e.def.flying ? 1 : 1.3);
    e.kx += Math.cos(opts.angle) * kb;
    e.ky += Math.sin(opts.angle) * kb;
  }
  if (opts.effect && world.rng.chance(opts.effect.chance ?? 1)) applyEffect(world, e, opts.effect, src);
  if (e.hp <= 0) killEnemy(world, e, src);
  else if (e.affix) AFFIXES[e.affix]?.onDamaged?.(world, e);
  return dmg;
}

export function applyEffect(world, e, eff, src) {
  const bossMul = e.def.boss ? 0.5 : 1;
  switch (eff.type) {
    case 'fogo':
      e.status.burn = { t: eff.duration * bossMul, dps: eff.power, tick: 0, src };
      break;
    case 'veneno':
      e.status.poison = { t: Math.min(8, (e.status.poison?.t || 0) + eff.duration * bossMul), dps: eff.power, tick: 0, src };
      break;
    case 'gelo':
      e.status.slow = Math.max(e.status.slow || 0, eff.duration * bossMul);
      e.status.slowMul = eff.power ?? 0.5;
      if (!e.def.boss && eff.freeze && world.rng.chance(eff.freeze)) {
        e.status.stun = Math.max(e.status.stun || 0, 1);
        e.status.frozen = 1;
      }
      break;
    case 'choque':
      chainShock(world, e, eff, src);
      break;
    case 'atordoar':
      if (!e.def.boss) e.status.stun = Math.max(e.status.stun || 0, eff.duration);
      else e.status.slow = Math.max(e.status.slow || 0, eff.duration * 0.5), e.status.slowMul = 0.6;
      break;
  }
}

function chainShock(world, first, eff, src) {
  const points = chainFrom(world, first, { chains: eff.chains ?? 2, radius: eff.radius ?? 130, damage: eff.power ?? 3, source: src });
  if (points.length > 1) world.emit('chain', { points });
}

/**
 * Raio que pula de "first" para os vizinhos mais próximos (sem repetir), causando dano em cada salto.
 * O dano do salto i é damage * falloff^i. Devolve os pontos do raio (começando em first).
 */
export function chainFrom(world, first, { chains = 2, radius = 130, damage = 3, falloff = 1, source = null, effect = null } = {}) {
  const hit = new Set([first.id]);
  const points = [[first.x, first.y]];
  let cur = first, dmg = damage;
  for (let i = 0; i < chains; i++) {
    let next = null, bd = radius;
    for (const e of world.enemies) {
      if (e.dead || e.spawning > 0 || e.burrowed || hit.has(e.id) || e.def.invulnerable) continue;
      const d = Math.hypot(e.x - cur.x, e.y - cur.y);
      if (d < bd) { bd = d; next = e; }
    }
    if (!next) break;
    hit.add(next.id);
    points.push([next.x, next.y]);
    dmg *= falloff;
    damageEnemy(world, next, dmg, { source, noMul: true, effect: effect && effect.type !== 'choque' ? effect : null });
    cur = next;
  }
  return points;
}

/** Explosão em área (dano em inimigos; opcionalmente nos jogadores). */
export function explode(world, x, y, radius, damage, { source = null, effect = null, hurtsPlayers = false, style = 'chalk', playerDamage = 1 } = {}) {
  world.emit('explosion', { x, y, radius, style });
  damagePropsInRadius(world, x, y, radius * 0.8, damage);
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.burrowed) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < radius + e.r) {
      damageEnemy(world, e, damage, { source, effect, knockback: 160, angle: Math.atan2(e.y - y, e.x - x), noMul: true });
    }
  }
  if (hurtsPlayers) {
    for (const p of world.players) {
      if (Math.hypot(p.x - x, p.y - y) < radius + p.r) hurtPlayer(world, p, playerDamage);
    }
    // explosão de inimigo também fere os aliados com vida
    for (const a of world.allies) {
      if (a.dead || !(a.hp > 0)) continue;
      if (Math.hypot(a.x - x, a.y - y) < radius + a.r) hurtAlly(world, a, playerDamage);
    }
  }
}

/** Dano em aliado com vida (hp); ao chegar a 0 ele some. Aliado sem hp é indestrutível. */
export function hurtAlly(world, a, amount) {
  if (a.dead || !(a.hp > 0)) return;
  a.hp = Math.max(0, a.hp - amount);
  a.flash = 0.1;
  if (a.hp <= 0) {
    a.dead = true;
    world.emit('ally_end', { x: a.x, y: a.y, kind: a.kind });
  }
}

export function killEnemy(world, e, src) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  world.stats.kills++;
  if (src) src.kills++;
  world.emit('enemy_die', { x: e.x, y: e.y, enemyType: e.type, boss: !!e.def.boss, id: e.id });
  const drops = e.def.drops || {};
  if (e.def.onDeathExplode && !e.exploded) {
    e.exploded = true;
    explode(world, e.x, e.y, e.def.onDeathExplode.radius, e.def.onDeathExplode.damage, { style: 'barrel' });
  }
  if (!e.minion) BEHAVIOR_HOOKS[e.def.behavior]?.onDeath?.(world, e);
  if (!e.minion && e.affix) AFFIXES[e.affix]?.onDeath?.(world, e);
  if (e.minion) return; // invocações do chefe não dão drop
  const mul = e.elite ? 2 : 1;
  if (drops.energy) dropEnergy(world, e.x, e.y, world.rng.int(drops.energy[0], drops.energy[1]) * mul);
  if (drops.coins) dropCoins(world, e.x, e.y, world.rng.int(drops.coins[0], drops.coins[1]) * mul);
  if (e.def.boss) {
    // chefe: arma rara ou melhor + portal
    const room = world.rooms[e.roomId];
    room.bossDefeated = true;
    const weaponId = world.data.rollWeapon(world.rng, null, 'rara');
    dropWeapon(world, weaponId, e.x - 30, e.y + 10);
    createPickup(world, 'health', e.x + 30, e.y + 10, {});
    const px = (room.cx + 0.5) * TILE, py = (room.cy + 2.5) * TILE;
    createPickup(world, 'portal', px, py, {});
    dropCoins(world, e.x, e.y, 10);
    // apaga projéteis inimigos restantes, invocações e áreas do chefe; solta quem estava preso
    for (const pr of world.projectiles) if (pr.team === 'enemy') pr.dead = true;
    for (const m of world.enemies) if ((m.minion || m.roomId === e.roomId) && !m.dead && m !== e) { m.minion = true; killEnemy(world, m, null); }
    for (const a of world.areas) a.dead = true;
    for (const p of world.players) { p.signing = 0; p.jailTimer = Math.min(p.jailTimer || 0, 0.01); }
    world.emit('boss_defeated', { x: e.x, y: e.y, name: e.def.name });
  } else if (world.rng.chance(e.elite ? 0.12 : 0.03)) {
    dropWeapon(world, world.data.rollWeapon(world.rng, world.floorDef.chestRarityWeights), e.x, e.y);
  }
}

/** Dano em jogador: escudo primeiro, depois vida. */
export function hurtPlayer(world, p, amount, opts = {}) {
  if (p.dead || p.downed || p.invuln > 0 || p.dash || p.jailTimer > 0 || world.state !== 'playing') return false;
  let left = amount;
  if (p.shield > 0) {
    const a = Math.min(p.shield, left);
    p.shield -= a;
    left -= a;
  }
  p.hp -= left;
  p.invuln = INVULN_TIME;
  p.shieldDelay = 0;
  p.damageTaken += amount;
  world.emit('player_hit', { id: p.id, x: p.x, y: p.y, amount, shieldOnly: left === 0 });
  if (opts.slow) p.slowTimer = Math.max(p.slowTimer, opts.slow);
  if (p.hp <= 0) {
    p.hp = 0;
    p.downed = true;
    p.reviveProgress = 0;
    world.emit('player_down', { id: p.id, x: p.x, y: p.y });
  }
  return true;
}
