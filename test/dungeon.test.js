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

test('andares têm 5 a 8 salas além da entrada e do chefe, com baú, loja e tudo alcançável', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const floorDef = data.floor((seed % 3) + 1);
    const { map, rooms, startRoomId, bossRoomId } = generateFloor({ rng: new RNG(seed), floorDef });
    assert.ok(rooms.length >= 7 && rooms.length <= 10, `seed ${seed}: ${rooms.length} salas`);
    assert.equal(rooms.filter((r) => r.type === 'start').length, 1);
    assert.equal(rooms.filter((r) => r.type === 'boss').length, 1);
    assert.ok(rooms.filter((r) => r.type === 'chest').length >= 1);
    assert.equal(rooms.filter((r) => r.type === 'shop').length, 1);
    assert.ok(rooms.some((r) => r.type === 'statue' || r.type === 'heal'));
    assert.ok(rooms.filter((r) => r.type === 'combat').length >= 3);
    const boss = rooms[bossRoomId];
    assert.equal(boss.links.length, 1, 'chefe deve ser sala-folha');
    assert.ok(!boss.links.includes(startRoomId), 'chefe não pode ser vizinho da entrada');
    const start = rooms[startRoomId];
    const seen = floodFrom(map, start.cx, start.cy);
    for (const r of rooms) {
      // toda porta da sala é alcançável a partir da entrada
      for (const d of r.doors) assert.ok(seen[map.idx(d.tx, d.ty)], `seed ${seed}: porta da sala ${r.id} inalcançável`);
      if (r.layout !== 'centro') assert.equal(map.get(r.cx, r.cy), T.FLOOR, `seed ${seed}: centro da sala ${r.id} bloqueado`);
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

test('salas de combate têm obstáculos variados (paredes, caixas, barris) sem bloquear portas', () => {
  const layouts = new Set();
  let props = 0, barrels = 0, traps = 0, walls = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const { map, rooms } = generateFloor({ rng: new RNG(seed), floorDef: data.floor(3) });
    traps += map.traps.length;
    for (const p of map.props.values()) { props++; if (p.kind === 'barril') barrels++; }
    for (const r of rooms.filter((x) => x.type === 'combat')) {
      layouts.add(r.layout);
      for (let y = r.y0 + 1; y < r.y0 + r.h - 1; y++) for (let x = r.x0 + 1; x < r.x0 + r.w - 1; x++) if (map.get(x, y) === T.WALL) walls++;
      // toda porta tem caminho até o centro da sala, mesmo contando caixas como sólidas
      const seen = new Set();
      const st = [[r.doors[0].tx, r.doors[0].ty]];
      while (st.length) {
        const [x, y] = st.pop();
        const k = x + ',' + y;
        if (seen.has(k)) continue;
        seen.add(k);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < r.x0 || ny < r.y0 || nx >= r.x0 + r.w || ny >= r.y0 + r.h) continue;
          const t = map.get(nx, ny);
          if (t === T.FLOOR || t === T.DOOR) st.push([nx, ny]);
        }
      }
      for (const d of r.doors) assert.ok(seen.has(d.tx + ',' + d.ty), `seed ${seed} sala ${r.id}: porta isolada`);
    }
  }
  assert.ok(layouts.size >= 5, 'deveria haver vários tipos de planta: ' + [...layouts]);
  assert.ok(props > 100 && barrels > 10 && traps > 20 && walls > 100, `props ${props} barris ${barrels} espinhos ${traps} paredes ${walls}`);
});
