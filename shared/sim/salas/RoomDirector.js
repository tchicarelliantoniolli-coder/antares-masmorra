import { TILE, T, SPAWN_TIME } from '../constants.js';
import { createEnemy } from '../inimigos/Enemy.js';
import { createPickup, dropEnergy, BLESSINGS, SHOP_PRICES } from './Pickups.js';

/** Coloca baús, enfermarias e placas nas salas especiais. */
export function setupRoomContents(world) {
  for (const r of world.rooms) {
    const cx = (r.cx + 0.5) * TILE, cy = (r.cy + 0.5) * TILE;
    if (r.type === 'chest') createPickup(world, 'chest', cx, cy, { roomId: r.id });
    if (r.type === 'heal') createPickup(world, 'heal_station', cx, cy, { roomId: r.id });
    if (r.type === 'shop') setupShop(world, r);
    if (r.type === 'statue') {
      const blessing = world.rng.pick(Object.keys(BLESSINGS));
      createPickup(world, 'statue', cx, cy, { roomId: r.id, blessing, price: Math.round((12 + 6 * world.floorNum) * priceMul(world)), usedBy: [] });
    }
  }
}

const priceMul = (world) => world.data.difficulty?.priceMul ?? 1;

/** Cantina: a "tia da cantina" vende armas, maçãs, suco e broches. */
function setupShop(world, r) {
  const y = (r.cy + 1.5) * TILE;
  createPickup(world, 'npc', (r.cx + 0.5) * TILE, (r.y0 + 2.2) * TILE, { npc: 'cantineira' });
  for (let x = r.cx - 5; x <= r.cx + 5; x++) world.map.set(x, r.y0 + 3, T.OBSTACLE); // balcão
  const mult = 1 + 0.25 * (world.floorNum - 1);
  const weights = { comum: 10, incomum: 35, rara: 35, epica: 15, lendaria: 5 };
  const items = [];
  for (let i = 0; i < 2; i++) {
    const weaponId = world.data.rollWeapon(world.rng, weights);
    const w = world.data.weapon(weaponId);
    items.push({ item: 'weapon', weaponId, price: Math.round(SHOP_PRICES[w.rarity] * mult * priceMul(world)) });
  }
  items.push({ item: 'apple', price: Math.round(8 * priceMul(world)) });
  items.push({ item: world.rng.chance(0.5) ? 'suco' : 'broche', price: Math.round(10 * priceMul(world)) });
  items.forEach((it, i) => {
    createPickup(world, 'shop_item', (r.cx + 0.5 - 4.5 + i * 3) * TILE, y, { roomId: r.id, ...it });
  });
}

/** Ponto está completamente dentro da sala (além da linha das portas)? */
export function isInsideRoom(r, x, y, margin = 14) {
  return x > (r.x0 + 1) * TILE + margin && x < (r.x0 + r.w - 1) * TILE - margin &&
         y > (r.y0 + 1) * TILE + margin && y < (r.y0 + r.h - 1) * TILE - margin;
}

export function updateRooms(world, dt) {
  const alive = world.alivePlayers();
  // Descoberta (minimapa)
  for (const p of world.players) {
    if (p.dead) continue;
    const r = world.roomAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    p.roomId = r ? r.id : -1;
    if (r && !r.visited && isInsideRoom(r, p.x, p.y, 0)) {
      r.visited = true;
      r.discovered = true;
      for (const id of r.links) world.rooms[id].discovered = true;
      if (r.type !== 'combat' && r.type !== 'boss' && r.state === 'idle') r.state = 'cleared';
    }
  }

  const room = world.activeRoom;
  if (!room) {
    for (const r of world.rooms) {
      if (r.state !== 'idle' || (r.type !== 'combat' && r.type !== 'boss')) continue;
      const trigger = alive.find((p) => isInsideRoom(r, p.x, p.y, p.r + 4));
      if (trigger) {
        activateRoom(world, r, trigger);
        break;
      }
    }
    return;
  }

  // Sala ativa: controla ondas
  if (room.pendingWave !== undefined) {
    room.waveDelay -= dt;
    if (room.waveDelay <= 0) {
      spawnWave(world, room, room.pendingWave);
      room.pendingWave = undefined;
    }
    return;
  }
  const remaining = world.enemies.some((e) => e.roomId === room.id && !e.dead && !e.minion);
  if (remaining) return;
  if (room.type === 'combat' && room.waveIndex < room.waves.length - 1) {
    room.pendingWave = room.waveIndex + 1;
    room.waveDelay = 0.7;
    return;
  }
  if (room.type === 'boss' && !room.bossDefeated) return;
  clearRoom(world, room);
}

function activateRoom(world, room, trigger) {
  room.state = 'active';
  world.activeRoom = room;
  world.map.locked.add(room.id);
  // Puxa para dentro quem ficou para trás (o time entra junto)
  for (const p of world.players) {
    if (p.dead) continue;
    if (!isInsideRoom(room, p.x, p.y, p.r + 2)) {
      p.x = trigger.x + world.rng.range(-8, 8);
      p.y = trigger.y + world.rng.range(-8, 8);
      world.emit('teleport', { id: p.id, x: p.x, y: p.y });
    }
  }
  world.emit('room_lock', { roomId: room.id });
  if (room.type === 'boss') {
    const def = world.floorDef;
    const boss = createEnemy(world, def.boss, (room.cx + 0.5) * TILE, (room.cy - 3 + 0.5) * TILE, room.id, { spawnTime: 1.6 });
    world.boss = boss;
    world.emit('boss_intro', { name: boss.def.name, title: boss.def.title || '', id: boss.id });
  } else {
    room.pendingWave = 0;
    room.waveDelay = 0.35;
  }
}

/**
 * Garante um inimigo de cada papel do andar (floorDef.waveRoles) quando a onda comporta (mais inimigos que papéis; ondas pequenas ficam como foram geradas):
 * troca um inimigo de papel repetido por um do papel que falta, sorteado do enemyPool com world.rng.
 */
function coverRoles(world, types) {
  const roles = world.floorDef.waveRoles || [];
  if (types.length <= roles.length) return types;
  const roleOf = (t) => world.data.enemy(t).role;
  for (const role of roles) {
    if (types.some((t) => roleOf(t) === role)) continue;
    const pool = {};
    for (const [t, w] of Object.entries(world.floorDef.enemyPool)) if (roleOf(t) === role) pool[t] = w;
    if (!Object.keys(pool).length) continue;
    // só troca um inimigo cujo papel aparece mais de uma vez (ou não pertence a nenhum papel do andar)
    const slot = types.findIndex((t) => !roles.includes(roleOf(t)) || types.filter((o) => roleOf(o) === roleOf(t)).length > 1);
    if (slot < 0) continue;
    types[slot] = world.rng.weighted(pool);
  }
  return types;
}

export function spawnWave(world, room, index) {
  room.waveIndex = index;
  const types = coverRoles(world, [...room.waves[index]]);
  // Mais jogadores = mais inimigos
  const extra = Math.round(types.length * (world.data.difficulty?.extraEnemies ?? 0.4) * Math.max(0, world.players.length - 1));
  for (let i = 0; i < extra; i++) types.push(world.rng.pick(room.waves[index]));
  const cells = freeCells(world, room, 2);
  const players = world.alivePlayers();
  for (const type of types) {
    let best = null;
    for (let tries = 0; tries < 20; tries++) {
      const c = world.rng.pick(cells);
      const x = (c[0] + 0.5) * TILE, y = (c[1] + 0.5) * TILE;
      const near = players.some((p) => Math.hypot(p.x - x, p.y - y) < 150);
      best = [x, y];
      if (!near) break;
    }
    const elite = world.rng.chance(world.floorDef.eliteChance || 0);
    createEnemy(world, type, best[0], best[1], room.id, { spawnTime: SPAWN_TIME, elite });
  }
  world.emit('wave_start', { roomId: room.id, wave: index + 1, total: room.waves.length });
}

export function freeCells(world, room, margin = 1) {
  const out = [];
  for (let y = room.y0 + 1 + margin; y < room.y0 + room.h - 1 - margin; y++) {
    for (let x = room.x0 + 1 + margin; x < room.x0 + room.w - 1 - margin; x++) {
      if (world.map.get(x, y) === T.FLOOR) out.push([x, y]);
    }
  }
  return out;
}

function clearRoom(world, room) {
  room.state = 'cleared';
  world.activeRoom = null;
  world.map.locked.delete(room.id);
  world.stats.roomsCleared++;
  world.emit('room_clear', { roomId: room.id });
  // recompensa pequena (no chão livre mais perto do centro)
  const [ftx, fty] = nearestFreeTile(world, room.cx, room.cy);
  const cx = (ftx + 0.5) * TILE, cy = (fty + 0.5) * TILE;
  if (room.type === 'combat') {
    dropEnergy(world, cx, cy, world.rng.int(3, 6));
    if (world.rng.chance(world.data.difficulty?.dropHealthChance ?? 0.25)) createPickup(world, 'health', cx + 10, cy, {});
  }
}

export function nearestFreeTile(world, cx, cy) {
  for (let r = 0; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (world.map.get(cx + dx, cy + dy) === T.FLOOR) return [cx + dx, cy + dy];
    }
  }
  return [cx, cy];
}
