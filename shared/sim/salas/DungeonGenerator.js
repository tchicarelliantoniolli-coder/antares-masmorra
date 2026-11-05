import { CELL, GRID_W, GRID_H, T, THEME_INDEX, CORRIDOR_HALF } from '../constants.js';
import { TileMap } from './TileMap.js';

const DIRS = [
  { dx: 1, dy: 0, name: 'E' },
  { dx: -1, dy: 0, name: 'W' },
  { dx: 0, dy: 1, name: 'S' },
  { dx: 0, dy: -1, name: 'N' }
];

const ROOM_SIZES = {
  start: () => [13, 13],
  chest: () => [13, 11],
  heal: () => [13, 11],
  boss: () => [25, 21],
  combat: (rng) => [rng.pick([17, 19, 21]), rng.pick([13, 15, 17])]
};

/**
 * Gera um andar: 5 a 8 salas numa grade, ligadas por corredores.
 * Garante: caminho principal Entrada -> ... -> Chefe (chefe é sempre uma "folha" e fica longe da entrada),
 * uma sala de baú e, em andares maiores, uma enfermaria.
 */
export function generateFloor({ rng, floorDef, roomCount = null }) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const layout = tryLayout(rng, roomCount ?? rng.int(5, 8));
    if (layout) return buildFloor(rng, layout, floorDef);
  }
  throw new Error('Falha ao gerar o andar');
}

function key(gx, gy) { return gx + ',' + gy; }

function tryLayout(rng, n) {
  const cells = new Map(); // key -> node
  const nodes = [];
  const add = (gx, gy, parent) => {
    const node = { id: nodes.length, gx, gy, links: [] };
    nodes.push(node);
    cells.set(key(gx, gy), node);
    if (parent) { node.links.push(parent.id); parent.links.push(node.id); }
    return node;
  };
  const freeNeighbors = (node) => DIRS
    .map((d) => [node.gx + d.dx, node.gy + d.dy])
    .filter(([x, y]) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H && !cells.has(key(x, y)));

  const start = add(rng.int(0, GRID_W - 1), rng.int(0, GRID_H - 1), null);
  // Caminho principal até o chefe
  const mainLen = Math.min(n, rng.int(4, 5));
  let cur = start;
  const main = [start];
  for (let i = 1; i < mainLen; i++) {
    const free = freeNeighbors(cur);
    if (!free.length) return null;
    const [x, y] = rng.pick(free);
    cur = add(x, y, cur);
    main.push(cur);
  }
  const boss = cur;
  // Ramificações (nunca a partir do chefe)
  let guard = 0;
  while (nodes.length < n && guard++ < 100) {
    const candidates = nodes.filter((nd) => nd !== boss && freeNeighbors(nd).length);
    if (!candidates.length) return null;
    const from = rng.pick(candidates);
    const [x, y] = rng.pick(freeNeighbors(from));
    add(x, y, from);
  }
  if (nodes.length < n) return null;

  // Tipos de sala
  for (const nd of nodes) nd.type = 'combat';
  start.type = 'start';
  boss.type = 'boss';
  const leaves = rng.shuffle(nodes.filter((nd) => nd.type === 'combat' && nd.links.length === 1));
  const others = rng.shuffle(nodes.filter((nd) => nd.type === 'combat' && nd.links.length > 1));
  const pickSpecial = () => leaves.shift() || others.shift();
  const chest = pickSpecial();
  if (!chest) return null;
  chest.type = 'chest';
  if (n >= 7) {
    const heal = pickSpecial();
    if (heal) heal.type = 'heal';
  }
  // Pelo menos 2 salas de combate
  if (nodes.filter((nd) => nd.type === 'combat').length < 2) return null;
  // O chefe não pode estar ligado direto à entrada
  if (boss.links.includes(start.id)) return null;
  return { nodes, startId: start.id, bossId: boss.id };
}

function buildFloor(rng, layout, floorDef) {
  const map = new TileMap(GRID_W * CELL, GRID_H * CELL);
  const corridorTheme = THEME_INDEX.corredor;
  const rooms = layout.nodes.map((nd) => {
    const [w, h] = ROOM_SIZES[nd.type](rng);
    const cx = nd.gx * CELL + Math.floor(CELL / 2);
    const cy = nd.gy * CELL + Math.floor(CELL / 2);
    let theme;
    if (nd.type === 'boss') theme = floorDef.bossTheme;
    else if (nd.type === 'start') theme = 'patio';
    else if (nd.type === 'heal') theme = 'laboratorio';
    else theme = rng.pick(floorDef.themes);
    return {
      id: nd.id,
      gx: nd.gx, gy: nd.gy,
      type: nd.type,
      theme,
      w, h,
      x0: cx - Math.floor(w / 2),
      y0: cy - Math.floor(h / 2),
      cx, cy,
      links: [...nd.links],
      doors: [],
      waves: [],
      waveIndex: -1,
      state: 'idle',
      visited: false,
      discovered: false
    };
  });

  // Escava salas
  for (const r of rooms) {
    const th = THEME_INDEX[r.theme] ?? 0;
    for (let y = r.y0; y < r.y0 + r.h; y++) {
      for (let x = r.x0; x < r.x0 + r.w; x++) {
        const border = x === r.x0 || y === r.y0 || x === r.x0 + r.w - 1 || y === r.y0 + r.h - 1;
        map.set(x, y, border ? T.WALL : T.FLOOR, r.id, th);
      }
    }
  }

  // Corredores + portas
  const done = new Set();
  for (const a of rooms) {
    for (const bid of a.links) {
      const k = Math.min(a.id, bid) + '-' + Math.max(a.id, bid);
      if (done.has(k)) continue;
      done.add(k);
      const b = rooms[bid];
      carveCorridor(map, a, b, corridorTheme);
    }
  }

  // Obstáculos nas salas de combate (simétricos, sem bloquear a "cruz" central que liga as portas)
  for (const r of rooms) {
    if (r.type === 'combat') placeObstacles(rng, map, r);
  }

  // Ondas de inimigos
  for (const r of rooms) {
    if (r.type !== 'combat') continue;
    const waves = rng.int(floorDef.wavesPerRoom[0], floorDef.wavesPerRoom[1]);
    for (let i = 0; i < waves; i++) {
      const count = rng.int(floorDef.enemiesPerWave[0], floorDef.enemiesPerWave[1]);
      const wave = [];
      for (let j = 0; j < count; j++) wave.push(rng.weighted(floorDef.enemyPool));
      r.waves.push(wave);
    }
  }

  return { map, rooms, startRoomId: layout.startId, bossRoomId: layout.bossId };
}

function carveCorridor(map, a, b, theme) {
  if (a.gy === b.gy) {
    // horizontal
    const [L, R] = a.gx < b.gx ? [a, b] : [b, a];
    const cy = L.cy;
    const xStart = L.x0 + L.w - 1; // parede direita de L
    const xEnd = R.x0;              // parede esquerda de R
    for (let x = xStart; x <= xEnd; x++) {
      for (let dy = -CORRIDOR_HALF - 1; dy <= CORRIDOR_HALF + 1; dy++) {
        const y = cy + dy;
        const edge = Math.abs(dy) === CORRIDOR_HALF + 1;
        if (x === xStart || x === xEnd) {
          if (!edge) {
            const owner = x === xStart ? L.id : R.id;
            map.set(x, y, T.DOOR, owner);
          }
        } else if (edge) {
          if (map.get(x, y) === T.VOID) map.set(x, y, T.WALL, -1, theme);
        } else {
          map.set(x, y, T.FLOOR, -1, theme);
        }
      }
    }
    L.doors.push({ dir: 'E', tx: xStart, ty: cy, to: R.id });
    R.doors.push({ dir: 'W', tx: xEnd, ty: cy, to: L.id });
  } else {
    const [U, D] = a.gy < b.gy ? [a, b] : [b, a];
    const cx = U.cx;
    const yStart = U.y0 + U.h - 1;
    const yEnd = D.y0;
    for (let y = yStart; y <= yEnd; y++) {
      for (let dx = -CORRIDOR_HALF - 1; dx <= CORRIDOR_HALF + 1; dx++) {
        const x = cx + dx;
        const edge = Math.abs(dx) === CORRIDOR_HALF + 1;
        if (y === yStart || y === yEnd) {
          if (!edge) {
            const owner = y === yStart ? U.id : D.id;
            map.set(x, y, T.DOOR, owner);
          }
        } else if (edge) {
          if (map.get(x, y) === T.VOID) map.set(x, y, T.WALL, -1, theme);
        } else {
          map.set(x, y, T.FLOOR, -1, theme);
        }
      }
    }
    U.doors.push({ dir: 'S', tx: cx, ty: yStart, to: D.id });
    D.doors.push({ dir: 'N', tx: cx, ty: yEnd, to: U.id });
  }
}

function placeObstacles(rng, map, r) {
  const shapes = [[1, 1], [2, 1], [1, 2], [2, 2]];
  const clusters = rng.int(0, 2);
  const ix0 = r.x0 + 3, iy0 = r.y0 + 3;           // margem de 2 tiles livres junto às paredes
  const halfW = r.cx - 3 - ix0, halfH = r.cy - 3 - iy0;
  for (let c = 0; c < clusters; c++) {
    const [sw, sh] = rng.pick(shapes);
    if (halfW < sw || halfH < sh) continue;
    const ox = rng.int(0, halfW - sw), oy = rng.int(0, halfH - sh);
    const quads = rng.chance(0.5) ? 4 : 2;
    for (let q = 0; q < quads; q++) {
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          let tx = ix0 + ox + x, ty = iy0 + oy + y;
          // espelha em torno do centro
          if (q === 1 || q === 3) tx = 2 * r.cx - tx;
          if (q === 2 || q === 3 || (quads === 2 && q === 1)) ty = 2 * r.cy - ty;
          if (map.get(tx, ty) === T.FLOOR) map.set(tx, ty, T.OBSTACLE);
        }
      }
    }
  }
}

/** Verifica se o retângulo interno de uma sala contém o ponto (em tiles). */
export function roomContainsTile(r, tx, ty) {
  return tx > r.x0 && ty > r.y0 && tx < r.x0 + r.w - 1 && ty < r.y0 + r.h - 1;
}
