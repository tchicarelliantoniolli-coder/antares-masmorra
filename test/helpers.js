import { loadGameDataNode } from '../shared/sim/loadDataNode.js';
import { World } from '../shared/sim/World.js';
import { TILE } from '../shared/sim/constants.js';
import { createEnemy } from '../shared/sim/inimigos/Enemy.js';
import { normalizeWeapon } from '../shared/sim/data.js';

export const data = loadGameDataNode();

export function makeWorld(opts = {}) {
  return new World({ data, seed: 1234, players: [{ id: 'p1', characterId: 'harilson' }], ...opts });
}

/** Coloca o jogador no centro de uma sala. */
export function putInRoom(world, p, room) {
  const [tx, ty] = nearestFree(world, room.cx, room.cy);
  p.x = (tx + 0.5) * TILE;
  p.y = (ty + 0.5) * TILE;
}

export function nearestFree(world, cx, cy) {
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (world.map.get(cx + dx, cy + dy) === 1) return [cx + dx, cy + dy];
    }
  }
  return [cx, cy];
}

export function run(world, seconds, inputs = {}) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) world.step(1 / 60, typeof inputs === 'function' ? inputs(world, i) : inputs);
}

/** Inimigo parado que não ataca (alvo de treino). */
export function dummy(w, x, y, hp = 500) {
  const e = createEnemy(w, 'caderno_zumbi', x, y, -1, { spawnTime: 0 });
  e.hp = e.maxHp = hp;
  e.def = { ...e.def, behavior: 'none', contactDamage: 0, drops: {} };
  e.cd = 999;
  return e;
}

/** Registra uma arma de teste e coloca na mão do jogador. */
export function withWeapon(w, def, p = w.players[0]) {
  const full = { id: 't_' + Math.random().toString(36).slice(2, 8), name: 'Teste', category: 'fogo', rarity: 'comum', type: 'ranged', damage: 4, fireRate: 4, energyCost: 0, critChance: 0, inaccuracy: 0, ...def };
  data.weapons.set(full.id, normalizeWeapon(full));
  p.weapons = [full.id];
  p.cur = 0;
  return data.weapon(full.id);
}

/** Mundo de teste com o jogador no centro de uma sala de combate vazia (sem ondas). */
export function arena() {
  const w = makeWorld();
  const p = w.players[0];
  const room = w.rooms.find((r) => r.type === 'combat');
  putInRoom(w, p, room);
  room.state = 'cleared';
  p.energy = p.maxEnergy = 9999;
  return { w, p, room };
}

