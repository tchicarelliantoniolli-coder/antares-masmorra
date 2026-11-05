import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../shared/sim/rng.js';
import { generateFloor } from '../shared/sim/salas/DungeonGenerator.js';
import { T } from '../shared/sim/constants.js';
import { data } from './helpers.js';

function floodFrom(map, sx, sy) {
  const seen = new Uint8Array(map.w * map.h);
  const stack = [[sx, sy]];
  seen[map.idx(sx, sy)] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const i = map.idx(nx, ny);
      const t = map.tiles[i];
      if (seen[i] || !(t === T.FLOOR || t === T.DOOR)) continue;
      seen[i] = 1;
      stack.push([nx, ny]);
    }
  }
  return seen;
}

test('andares têm 5 a 8 salas, entrada, chefe e baú, e tudo é alcançável', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const { map, rooms, startRoomId, bossRoomId } = generateFloor({ rng: new RNG(seed), floorDef: data.floor(1) });
    assert.ok(rooms.length >= 5 && rooms.length <= 8, `seed ${seed}: ${rooms.length} salas`);
    assert.equal(rooms.filter((r) => r.type === 'start').length, 1);
    assert.equal(rooms.filter((r) => r.type === 'boss').length, 1);
    assert.equal(rooms.filter((r) => r.type === 'chest').length, 1);
    assert.ok(rooms.filter((r) => r.type === 'combat').length >= 2);
    const boss = rooms[bossRoomId];
    assert.equal(boss.links.length, 1, 'chefe deve ser sala-folha');
    assert.ok(!boss.links.includes(startRoomId), 'chefe não pode ser vizinho da entrada');
    const start = rooms[startRoomId];
    const seen = floodFrom(map, start.cx, start.cy);
    for (const r of rooms) assert.ok(seen[map.idx(r.cx, r.cy)] || map.get(r.cx, r.cy) !== T.FLOOR,
      `seed ${seed}: sala ${r.id} inalcançável`);
    for (const r of rooms) {
      // o centro de cada sala é chão livre
      assert.equal(map.get(r.cx, r.cy), T.FLOOR, `seed ${seed}: centro da sala ${r.id} bloqueado`);
      assert.ok(seen[map.idx(r.cx, r.cy)], `seed ${seed}: sala ${r.id} inalcançável`);
    }
  }
});

test('salas de combate têm ondas de inimigos válidos', () => {
  const { rooms } = generateFloor({ rng: new RNG(7), floorDef: data.floor(1) });
  for (const r of rooms.filter((x) => x.type === 'combat')) {
    assert.ok(r.waves.length >= 1);
    for (const wave of r.waves) for (const type of wave) assert.ok(data.enemies[type], type);
  }
});

test('mesma semente gera o mesmo andar', () => {
  const a = generateFloor({ rng: new RNG(99), floorDef: data.floor(1) });
  const b = generateFloor({ rng: new RNG(99), floorDef: data.floor(1) });
  assert.deepEqual([...a.map.tiles], [...b.map.tiles]);
});
