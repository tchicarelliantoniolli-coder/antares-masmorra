import { loadGameDataNode } from '../shared/sim/loadDataNode.js';
import { World } from '../shared/sim/World.js';
import { TILE } from '../shared/sim/constants.js';

export const data = loadGameDataNode();

export function makeWorld(opts = {}) {
  return new World({ data, seed: 1234, players: [{ id: 'p1', characterId: 'harilson' }], ...opts });
}

/** Coloca o jogador no centro de uma sala. */
export function putInRoom(world, p, room) {
  p.x = (room.cx + 0.5) * TILE;
  p.y = (room.cy + 0.5) * TILE;
}

export function run(world, seconds, inputs = {}) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) world.step(1 / 60, typeof inputs === 'function' ? inputs(world, i) : inputs);
}
