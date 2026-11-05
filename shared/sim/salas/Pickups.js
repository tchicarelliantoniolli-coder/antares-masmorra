import { INTERACT_RADIUS, PICKUP_MAGNET_RADIUS } from '../constants.js';

const INTERACTIVE = new Set(['weapon', 'chest', 'heal_station', 'portal', 'shop_item', 'statue']);
const RADIUS = { energy: 4, coin: 4, health: 6, weapon: 10, chest: 14, heal_station: 14, portal: 20, shop_item: 10, statue: 18, npc: 10 };

/** Bênçãos das estátuas (pagas com moedas, valem até o fim da partida). */
export const BLESSINGS = {
  sabedoria: { name: 'Estátua da Sabedoria', desc: '+20% de dano', apply: (p) => { p.mods.damageMul *= 1.2; } },
  disciplina: { name: 'Estátua da Disciplina', desc: '+2 de escudo máximo', apply: (p) => { p.maxShield += 2; p.shield += 2; } },
  esporte: { name: 'Estátua do Esporte', desc: '+15% de velocidade', apply: (p) => { p.mods.speedMul *= 1.15; } },
  paciencia: { name: 'Estátua da Paciência', desc: 'Habilidade recarrega 25% mais rápido', apply: (p) => { p.mods.skillCdMul *= 0.75; } },
  sorte: { name: 'Estátua da Sorte', desc: '+12% de chance de crítico', apply: (p) => { p.mods.critBonus += 0.12; } }
};

export const SHOP_PRICES = { comum: 12, incomum: 20, rara: 32, epica: 48, lendaria: 70 };

export function createPickup(world, kind, x, y, opts = {}) {
  const p = {
    id: world.newId(), kind, x, y, r: RADIUS[kind] ?? 6,
    vx: opts.vx || 0, vy: opts.vy || 0, t: 0, dead: false,
    ...opts
  };
  world.pickups.push(p);
  return p;
}

function scatter(world, kind, x, y, n, extra = {}) {
  for (let i = 0; i < n; i++) {
    const a = world.rng.range(0, Math.PI * 2), s = world.rng.range(60, 160);
    createPickup(world, kind, x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, amount: 1, delay: 0.35, ...extra });
  }
}
export const dropEnergy = (world, x, y, n) => scatter(world, 'energy', x, y, n, { amount: 4 });
export const dropCoins = (world, x, y, n) => scatter(world, 'coin', x, y, n, { amount: 1 });

export function dropWeapon(world, weaponId, x, y) {
  return createPickup(world, 'weapon', x, y, { weaponId });
}

export function updatePickups(world, dt) {
  const players = world.alivePlayers();
  for (const pk of world.pickups) {
    if (pk.dead) continue;
    pk.t += dt;
    if (pk.vx || pk.vy) {
      world.map.moveBox(pk, pk.vx * dt, pk.vy * dt);
      const f = Math.pow(0.02, dt);
      pk.vx *= f; pk.vy *= f;
      if (Math.abs(pk.vx) < 2 && Math.abs(pk.vy) < 2) pk.vx = pk.vy = 0;
    }
    if (pk.kind === 'energy' || pk.kind === 'coin' || pk.kind === 'health') {
      if (pk.delay > 0) { pk.delay -= dt; continue; }
      let best = null, bd = PICKUP_MAGNET_RADIUS;
      for (const p of players) {
        if (pk.kind === 'health' && p.hp >= p.maxHp) continue;
        if (pk.kind === 'energy' && p.energy >= p.maxEnergy) continue;
        const d = Math.hypot(p.x - pk.x, p.y - pk.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        if (bd < best.r + pk.r + 2) {
          collect(world, best, pk);
        } else {
          const s = 320 * dt / bd;
          pk.x += (best.x - pk.x) * s;
          pk.y += (best.y - pk.y) * s;
        }
      }
    } else if (pk.kind === 'portal') {
      pk.ready = true;
    }
  }
}

function collect(world, p, pk) {
  pk.dead = true;
  if (pk.kind === 'energy') {
    p.energy = Math.min(p.maxEnergy, p.energy + pk.amount);
    world.emit('pickup', { what: 'energy', x: pk.x, y: pk.y, playerId: p.id });
  } else if (pk.kind === 'coin') {
    p.coins += pk.amount;
    world.stats.coins += pk.amount;
    world.emit('pickup', { what: 'coin', x: pk.x, y: pk.y, playerId: p.id });
  } else if (pk.kind === 'health') {
    p.hp = Math.min(p.maxHp, p.hp + 2);
    world.emit('pickup', { what: 'health', x: pk.x, y: pk.y, playerId: p.id });
  }
}

/** Interativo mais próximo do jogador (arma, baú, enfermaria, portal). */
export function findInteractable(world, p) {
  let best = null, bd = Infinity;
  for (const pk of world.pickups) {
    if (pk.dead || !INTERACTIVE.has(pk.kind)) continue;
    if (pk.kind === 'chest' && pk.opened) continue;
    if (pk.kind === 'heal_station' && pk.used) continue;
    if (pk.kind === 'statue' && pk.usedBy.includes(p.id)) continue;
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    if (d < INTERACT_RADIUS + pk.r && d < bd) { bd = d; best = pk; }
  }
  return best;
}

export function interact(world, p, pk) {
  if (!pk) return;
  if (pk.kind === 'weapon') {
    if (p.weapons.length < 2) {
      p.weapons.push(pk.weaponId);
      p.cur = p.weapons.length - 1;
      pk.dead = true;
    } else {
      const old = p.weapons[p.cur];
      p.weapons[p.cur] = pk.weaponId;
      pk.weaponId = old; // a arma atual fica no chão no lugar dela
      pk.t = 0;
    }
    p.fireCd = 0.15;
    world.emit('weapon_pickup', { playerId: p.id, weaponId: p.weapons[p.cur], x: p.x, y: p.y });
  } else if (pk.kind === 'chest') {
    pk.opened = true;
    const weights = world.floorDef.chestRarityWeights;
    const weaponId = world.data.rollWeapon(world.rng, weights);
    dropWeapon(world, weaponId, pk.x, pk.y + 28);
    dropEnergy(world, pk.x, pk.y, 4);
    if (world.rng.chance(0.5)) dropCoins(world, pk.x, pk.y, world.rng.int(2, 5));
    world.emit('chest_open', { x: pk.x, y: pk.y, weaponId });
  } else if (pk.kind === 'heal_station') {
    pk.used = true;
    for (const q of world.players) {
      if (q.dead) continue;
      if (q.downed) { q.downed = false; q.reviveProgress = 0; }
      q.hp = q.maxHp;
      q.shield = q.maxShield;
    }
    world.emit('heal', { x: pk.x, y: pk.y });
  } else if (pk.kind === 'shop_item') {
    if (p.coins < pk.price) {
      world.emit('no_money', { playerId: p.id, x: p.x, y: p.y, price: pk.price });
      return;
    }
    p.coins -= pk.price;
    pk.dead = true;
    if (pk.item === 'weapon') createPickup(world, 'weapon', pk.x, pk.y, { weaponId: pk.weaponId });
    else if (pk.item === 'apple') p.hp = Math.min(p.maxHp, p.hp + 3);
    else if (pk.item === 'suco') p.energy = Math.min(p.maxEnergy, p.energy + 90);
    else if (pk.item === 'broche') { p.maxShield += 1; p.shield += 1; }
    world.emit('buy', { playerId: p.id, x: pk.x, y: pk.y, item: pk.item });
  } else if (pk.kind === 'statue') {
    if (p.coins < pk.price) {
      world.emit('no_money', { playerId: p.id, x: p.x, y: p.y, price: pk.price });
      return;
    }
    p.coins -= pk.price;
    pk.usedBy.push(p.id);
    const b = BLESSINGS[pk.blessing];
    b.apply(p);
    p.blessings.push(pk.blessing);
    world.emit('blessing', { playerId: p.id, x: pk.x, y: pk.y, name: b.name, desc: b.desc });
  } else if (pk.kind === 'shop_item') {
    if (p.coins < pk.price) {
      world.emit('no_money', { playerId: p.id, x: p.x, y: p.y, price: pk.price });
      return;
    }
    p.coins -= pk.price;
    pk.dead = true;
    if (pk.item === 'weapon') createPickup(world, 'weapon', pk.x, pk.y, { weaponId: pk.weaponId });
    else if (pk.item === 'apple') p.hp = Math.min(p.maxHp, p.hp + 3);
    else if (pk.item === 'suco') p.energy = Math.min(p.maxEnergy, p.energy + 90);
    else if (pk.item === 'broche') { p.maxShield += 1; p.shield += 1; }
    world.emit('buy', { playerId: p.id, x: pk.x, y: pk.y, item: pk.item });
  } else if (pk.kind === 'statue') {
    if (p.coins < pk.price) {
      world.emit('no_money', { playerId: p.id, x: p.x, y: p.y, price: pk.price });
      return;
    }
    p.coins -= pk.price;
    pk.usedBy.push(p.id);
    const b = BLESSINGS[pk.blessing];
    b.apply(p);
    p.blessings.push(pk.blessing);
    world.emit('blessing', { playerId: p.id, x: pk.x, y: pk.y, name: b.name, desc: b.desc });
  } else if (pk.kind === 'portal') {
    world.emit('portal_enter', { playerId: p.id });
    world.completeFloor();
  }
}
