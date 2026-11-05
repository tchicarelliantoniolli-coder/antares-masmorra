import { TILE, T, SPAWN_TIME } from '../constants.js';
import { createEnemy } from '../inimigos/Enemy.js';
import { createPickup, dropEnergy } from './Pickups.js';

/** Coloca baús, enfermarias e placas nas salas especiais. */
export function setupRoomContents(world) {
  for (const r of world.rooms) {
    const cx = (r.cx + 0.5) * TILE, cy = (r.cy + 0.5) * TILE;
    if (r.type === 'chest') createPickup(world, 'chest', cx, cy, { roomId: r.id });
    if (r.type === 'heal') createPickup(world, 'heal_station', cx, cy, { roomId: r.id });
  }
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

function spawnWave(world, room, index) {
  room.waveIndex = index;
  const types = [...room.waves[index]];
  // Mais jogadores = mais inimigos
  const extra = Math.max(0, world.players.length - 1);
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
    createEnemy(world, type, best[0], best[1], room.id, { spawnTime: SPAWN_TIME });
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
  // recompensa pequena
  const cx = (room.cx + 0.5) * TILE, cy = (room.cy + 0.5) * TILE;
  if (room.type === 'combat') {
    dropEnergy(world, cx, cy, world.rng.int(3, 6));
    if (world.rng.chance(0.25)) createPickup(world, 'health', cx + 10, cy, {});
  }
}
