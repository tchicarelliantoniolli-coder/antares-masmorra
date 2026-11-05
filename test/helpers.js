import { loadGameDataNode } from '../shared/sim/loadDataNode.js';
import { World } from '../shared/sim/World.js';
import { TILE } from '../shared/sim/constants.js';

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
