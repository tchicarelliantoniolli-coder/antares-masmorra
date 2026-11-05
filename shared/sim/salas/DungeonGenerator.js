import { CELL, GRID_W, GRID_H, T, THEME_INDEX, CORRIDOR_HALF } from '../constants.js';
import { TileMap } from './TileMap.js';

/**
 * Gerador de andares no estilo "Soul Knight":
 *  - salas retangulares numa grade, ligadas por corredores com portas;
 *  - caminho principal Entrada -> ... -> Chefe (o chefe é sempre uma "folha", longe da entrada);
 *  - salas especiais: baú, cantina (loja), estátua ou enfermaria;
 *  - salas de combate com "plantas" diferentes: pilares, paredes em L, trincheiras, bloco central...
 *    mais caixas destrutíveis, barris explosivos, espinhos no chão, móveis e decoração nas paredes.
 * Toda sala é verificada: todas as portas continuam ligadas entre si depois de colocar os obstáculos.
 */

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const ROOM_SIZES = {
  start: () => [15, 13],
  chest: () => [15, 13],
  heal: () => [15, 13],
  shop: () => [17, 13],
  statue: () => [15, 13],
  boss: () => [27, 23],
  combat: (rng) => [rng.pick([19, 21, 23]), rng.pick([15, 17, 19])]
};

export const COMBAT_LAYOUTS = ['pilares', 'pilares6', 'cantos', 'trincheiras', 'centro', 'xadrez', 'colunas', 'aberto'];

export function generateFloor({ rng, floorDef, roomCount = null }) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const extra = roomCount ?? rng.int(floorDef.rooms?.[0] ?? 5, floorDef.rooms?.[1] ?? 8);
    const layout = tryLayout(rng, extra, floorDef);
    if (layout) return buildFloor(rng, layout, floorDef);
  }
  throw new Error('Falha ao gerar o andar');
}

const key = (gx, gy) => gx + ',' + gy;

/** n = número de salas além da entrada e do chefe. */
function tryLayout(rng, n, floorDef) {
  const total = n + 2;
  const cells = new Map();
  const nodes = [];
  const add = (gx, gy, parent) => {
    const node = { id: nodes.length, gx, gy, links: [] };
    nodes.push(node);
    cells.set(key(gx, gy), node);
    if (parent) { node.links.push(parent.id); parent.links.push(node.id); }
    return node;
  };
  const freeNeighbors = (node) => DIRS
    .map(([dx, dy]) => [node.gx + dx, node.gy + dy])
    .filter(([x, y]) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H && !cells.has(key(x, y)));

  const start = add(rng.int(0, GRID_W - 1), rng.int(0, GRID_H - 1), null);
  const mainLen = Math.min(total, rng.int(5, 6));
  let cur = start;
  for (let i = 1; i < mainLen; i++) {
    const free = freeNeighbors(cur);
    if (!free.length) return null;
    const [x, y] = rng.pick(free);
    cur = add(x, y, cur);
  }
  const boss = cur;
  let guard = 0;
  while (nodes.length < total && guard++ < 200) {
    const candidates = nodes.filter((nd) => nd !== boss && freeNeighbors(nd).length);
    if (!candidates.length) return null;
    const from = rng.pick(candidates);
    const [x, y] = rng.pick(freeNeighbors(from));
    add(x, y, from);
  }
  if (nodes.length < total) return null;
  if (boss.links.length !== 1 || boss.links.includes(start.id)) return null;

  for (const nd of nodes) nd.type = 'combat';
  start.type = 'start';
  boss.type = 'boss';
  // Especiais preferem salas "folha" (sem saída), como no Soul Knight
  const leaves = rng.shuffle(nodes.filter((nd) => nd.type === 'combat' && nd.links.length === 1));
  const others = rng.shuffle(nodes.filter((nd) => nd.type === 'combat' && nd.links.length > 1));
  const pick = () => leaves.shift() || others.shift();
  const specials = ['chest', 'shop', rng.chance(0.5) ? 'statue' : 'heal'];
  if (n >= 7) specials.push(specials[2] === 'statue' ? 'heal' : 'statue');
  if (n >= 8 && (floorDef.floor || 1) >= 2) specials.push('chest');
  for (const type of specials) {
    const nd = pick();
    if (!nd) return null;
    nd.type = type;
  }
  if (nodes.filter((nd) => nd.type === 'combat').length < 3) return null;
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
    else if (nd.type === 'shop') theme = 'cantina';
    else if (nd.type === 'statue') theme = 'biblioteca';
    else theme = rng.pick(floorDef.themes);
    return {
      id: nd.id, gx: nd.gx, gy: nd.gy, type: nd.type, theme, w, h,
      x0: cx - Math.floor(w / 2), y0: cy - Math.floor(h / 2), cx, cy,
      links: [...nd.links], doors: [], waves: [], waveIndex: -1,
      layout: null, state: 'idle', visited: false, discovered: false
    };
  });

  for (const r of rooms) {
    const th = THEME_INDEX[r.theme] ?? 0;
    for (let y = r.y0; y < r.y0 + r.h; y++) {
      for (let x = r.x0; x < r.x0 + r.w; x++) {
        const border = x === r.x0 || y === r.y0 || x === r.x0 + r.w - 1 || y === r.y0 + r.h - 1;
        map.set(x, y, border ? T.WALL : T.FLOOR, r.id, th);
      }
    }
  }

  const done = new Set();
  for (const a of rooms) {
    for (const bid of a.links) {
      const k = Math.min(a.id, bid) + '-' + Math.max(a.id, bid);
      if (done.has(k)) continue;
      done.add(k);
      carveCorridor(map, a, rooms[bid], corridorTheme);
    }
  }

  for (const r of rooms) {
    if (r.type === 'combat') furnishCombat(rng, map, r, floorDef);
    else if (r.type === 'boss' && floorDef.bossPillars) bossPillars(map, r);
    else if (r.type === 'chest') cornerPillars(map, r);
    addWallDecor(rng, map, r);
  }

  const wpr = floorDef.wavesPerRoom || [2, 2];
  const epw = floorDef.enemiesPerWave || [3, 5];
  for (const r of rooms) {
    if (r.type !== 'combat') continue;
    const big = r.w * r.h >= 23 * 17;
    const waves = rng.int(wpr[0], wpr[1]) + (big && rng.chance(0.4) ? 1 : 0);
    for (let i = 0; i < waves; i++) {
      const count = rng.int(epw[0], epw[1]) + (big ? 1 : 0);
      const wave = [];
      for (let j = 0; j < count; j++) wave.push(rng.weighted(floorDef.enemyPool));
      r.waves.push(wave);
    }
  }
  return { map, rooms, startRoomId: layout.startId, bossRoomId: layout.bossId };
}

function carveCorridor(map, a, b, theme) {
  const horizontal = a.gy === b.gy;
  const [P, Q] = horizontal ? (a.gx < b.gx ? [a, b] : [b, a]) : (a.gy < b.gy ? [a, b] : [b, a]);
  const c = horizontal ? P.cy : P.cx;
  const s = horizontal ? P.x0 + P.w - 1 : P.y0 + P.h - 1;
  const e = horizontal ? Q.x0 : Q.y0;
  for (let i = s; i <= e; i++) {
    for (let d = -CORRIDOR_HALF - 1; d <= CORRIDOR_HALF + 1; d++) {
      const x = horizontal ? i : c + d;
      const y = horizontal ? c + d : i;
      const edge = Math.abs(d) === CORRIDOR_HALF + 1;
      if (i === s || i === e) {
        if (!edge) map.set(x, y, T.DOOR, i === s ? P.id : Q.id);
      } else if (edge) {
        if (map.get(x, y) === T.VOID) map.set(x, y, T.WALL, -1, theme);
      } else {
        map.set(x, y, T.FLOOR, -1, theme);
      }
    }
  }
  if (horizontal) {
    P.doors.push({ dir: 'E', tx: s, ty: c, to: Q.id });
    Q.doors.push({ dir: 'W', tx: e, ty: c, to: P.id });
  } else {
    P.doors.push({ dir: 'S', tx: c, ty: s, to: Q.id });
    Q.doors.push({ dir: 'N', tx: c, ty: e, to: P.id });
  }
}

// ------------------------------------------------------------------ mobília das salas de combate

/** Tiles "reservados": a 2 tiles de cada porta (para ninguém ficar preso ao entrar). */
function reservedSet(r) {
  const res = new Set();
  for (const d of r.doors) {
    for (let k = 1; k <= 3; k++) {
      for (let o = -2; o <= 2; o++) {
        let x, y;
        if (d.dir === 'E') { x = d.tx - k; y = d.ty + o; }
        else if (d.dir === 'W') { x = d.tx + k; y = d.ty + o; }
        else if (d.dir === 'S') { x = d.tx + o; y = d.ty - k; }
        else { x = d.tx + o; y = d.ty + k; }
        res.add(x + ',' + y);
      }
    }
  }
  return res;
}

function furnishCombat(rng, map, r, floorDef) {
  const ix0 = r.x0 + 1, iy0 = r.y0 + 1, ix1 = r.x0 + r.w - 2, iy1 = r.y0 + r.h - 2;
  const reserved = reservedSet(r);
  const backup = () => {
    const tiles = [];
    for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) tiles.push(map.get(x, y));
    return tiles;
  };
  const restore = (tiles) => {
    let i = 0;
    for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
      map.set(x, y, tiles[i++]);
      map.props.delete(map.idx(x, y));
    }
    map.traps = map.traps.filter((t) => !(t.tx >= ix0 && t.tx <= ix1 && t.ty >= iy0 && t.ty <= iy1));
  };
  const clean = backup();
  const order = rng.shuffle([...COMBAT_LAYOUTS]);
  for (let attempt = 0; attempt < order.length; attempt++) {
    const name = order[attempt];
    const ok = (x, y) => x > ix0 && x < ix1 && y > iy0 && y < iy1 && map.get(x, y) === T.FLOOR && !reserved.has(x + ',' + y);
    const put = (x, y, type, extra) => {
      if (!ok(x, y)) return false;
      map.set(x, y, type);
      if (type === T.PROP) map.props.set(map.idx(x, y), { ...extra });
      return true;
    };
    applyLayout(name, r, put);
    scatterProps(rng, r, put, floorDef);
    placeTraps(rng, map, r, ok, floorDef);
    if (connected(map, r)) {
      r.layout = name;
      return;
    }
    restore(clean);
  }
  r.layout = 'aberto';
}

/** Coloca o mesmo bloco nos 4 quadrantes (simétrico em relação ao centro). */
function sym4(r, put, offsets, type = T.WALL) {
  for (const [dx, dy] of offsets) {
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) put(r.cx + dx * sx, r.cy + dy * sy, type);
  }
}

function applyLayout(name, r, put) {
  const hw = Math.floor((r.w - 2) / 2), hh = Math.floor((r.h - 2) / 2);
  const a = Math.max(3, Math.floor(hw / 2)), b = Math.max(3, Math.floor(hh / 2));
  switch (name) {
    case 'pilares':
      sym4(r, put, [[a, b], [a + 1, b], [a, b + 1], [a + 1, b + 1]]);
      break;
    case 'pilares6':
      sym4(r, put, [[a + 1, b], [a + 1, b + 1]]);
      for (const sy of [1, -1]) { put(r.cx, r.cy + sy * b, T.WALL); put(r.cx, r.cy + sy * (b + 1), T.WALL); }
      break;
    case 'cantos':
      sym4(r, put, [[a, b], [a + 1, b], [a + 2, b], [a, b - 1], [a, b - 2]]);
      break;
    case 'trincheiras':
      for (let dx = 2; dx <= Math.min(a + 2, hw - 2); dx++) sym4(r, put, [[dx, b]]);
      break;
    case 'centro':
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) put(r.cx + dx, r.cy + dy, T.WALL);
      sym4(r, put, [[a + 1, b + 1]]);
      break;
    case 'xadrez':
      for (let dx = 3; dx < hw - 1; dx += 4) for (let dy = 2; dy < hh - 1; dy += 4) sym4(r, put, [[dx, dy]]);
      break;
    case 'colunas':
      for (let dy = 1; dy <= Math.min(3, hh - 3); dy++) sym4(r, put, [[a, dy]]);
      sym4(r, put, [[a, 0]]);
      break;
    default:
      break;
  }
}

function scatterProps(rng, r, put, floorDef) {
  const hw = Math.floor((r.w - 2) / 2), hh = Math.floor((r.h - 2) / 2);
  const randomSpot = () => {
    for (let i = 0; i < 10; i++) {
      const dx = rng.int(-hw + 2, hw - 2), dy = rng.int(-hh + 2, hh - 2);
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) return [r.cx + dx, r.cy + dy]; // centro fica livre
    }
    return [r.cx + hw - 2, r.cy + hh - 2];
  };
  // grupos de caixas
  const clusters = rng.int(2, 5);
  for (let c = 0; c < clusters; c++) {
    const [x, y] = randomSpot();
    const n = rng.int(1, 3);
    const cells = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]];
    for (let i = 0; i < n; i++) put(x + cells[i][0], y + cells[i][1], T.PROP, { kind: 'caixa', hp: 4, maxHp: 4 });
  }
  // barris explosivos (galões do laboratório)
  const barrels = rng.int(0, 2) + ((floorDef.floor || 1) >= 2 ? 1 : 0);
  for (let i = 0; i < barrels; i++) {
    const [x, y] = randomSpot();
    put(x, y, T.PROP, { kind: 'barril', hp: 2, maxHp: 2 });
  }
  // móveis do tema (indestrutíveis)
  if (rng.chance(0.6)) {
    const dx = rng.int(2, Math.max(2, hw - 3)), dy = rng.int(2, Math.max(2, hh - 3));
    put(r.cx + dx, r.cy + dy, T.OBSTACLE);
    put(r.cx - dx, r.cy - dy, T.OBSTACLE);
  }
}

function placeTraps(rng, map, r, ok, floorDef) {
  const chance = floorDef.trapChance ?? 0.4;
  if (!rng.chance(chance)) return;
  const patches = rng.int(1, 2);
  const hw = Math.floor((r.w - 2) / 2), hh = Math.floor((r.h - 2) / 2);
  for (let p = 0; p < patches; p++) {
    const x = r.cx + rng.int(-hw + 2, hw - 3), y = r.cy + rng.int(-hh + 2, hh - 3);
    const [w, h] = rng.pick([[2, 2], [3, 1], [1, 3], [3, 2]]);
    const phase = rng.range(0, 3);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (ok(x + i, y + j)) map.traps.push({ tx: x + i, ty: y + j, phase });
    }
  }
}

/** Todas as portas e quase todo o chão continuam alcançáveis? (caixas contam como sólidas) */
function connected(map, r) {
  const inside = (x, y) => x >= r.x0 && y >= r.y0 && x < r.x0 + r.w && y < r.y0 + r.h;
  const passable = (x, y) => { const t = map.get(x, y); return t === T.FLOOR || t === T.DOOR; };
  let free = 0;
  for (let y = r.y0 + 1; y < r.y0 + r.h - 1; y++) for (let x = r.x0 + 1; x < r.x0 + r.w - 1; x++) if (map.get(x, y) === T.FLOOR) free++;
  const start = r.doors[0] ? [r.doors[0].tx, r.doors[0].ty] : [r.cx, r.cy];
  const seen = new Set([start.join(',')]);
  const stack = [start];
  let reached = 0;
  while (stack.length) {
    const [x, y] = stack.pop();
    if (map.get(x, y) === T.FLOOR) reached++;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !inside(nx, ny) || !passable(nx, ny)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  for (const d of r.doors) if (!seen.has(d.tx + ',' + d.ty)) return false;
  return reached >= free * 0.9;
}

function bossPillars(map, r) {
  const a = 7, b = 5;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    for (const [dx, dy] of [[a, b], [a + 1, b], [a, b + 1], [a + 1, b + 1]]) map.set(r.cx + dx * sx, r.cy + dy * sy, T.WALL);
  }
}

function cornerPillars(map, r) {
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) map.set(r.cx + 4 * sx, r.cy + 3 * sy, T.WALL);
}

const WALL_DECOR = {
  sala_aula: ['lousa', 'cartaz', 'relogio'],
  laboratorio: ['tabela_periodica', 'cartaz_dna', 'relogio'],
  quadra: ['placar', 'cesta'],
  biblioteca: ['estante_parede', 'quadro'],
  patio: ['janela', 'janela'],
  secretaria: ['mural', 'relogio'],
  orientacao: ['quadro', 'mural'],
  coordenacao: ['quadro', 'relogio', 'mural'],
  cantina: ['cardapio']
};

/** Decoração presa na parede de cima (lousa, cartazes, relógio...). Não tem colisão. */
function addWallDecor(rng, map, r) {
  const kinds = WALL_DECOR[r.theme];
  if (!kinds) return;
  const n = r.type === 'combat' ? rng.int(1, 2) : 1;
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const kind = i === 0 ? kinds[0] : rng.pick(kinds);
    const width = kind === 'lousa' || kind === 'placar' || kind === 'estante_parede' ? 3 : 1;
    for (let t = 0; t < 10; t++) {
      const tx = rng.int(r.x0 + 2, r.x0 + r.w - 3 - width);
      let free = true;
      for (let k = -1; k <= width; k++) {
        if (used.has(tx + k) || Math.abs(tx + k - r.cx) <= 2) free = false;
        if (map.get(tx + k, r.y0) !== T.WALL || map.get(tx + k, r.y0 + 1) === T.WALL) free = false;
      }
      if (!free) continue;
      for (let k = 0; k < width; k++) used.add(tx + k);
      map.decor.push({ kind, tx, ty: r.y0, w: width });
      break;
    }
  }
}

export function roomContainsTile(r, tx, ty) {
  return tx > r.x0 && ty > r.y0 && tx < r.x0 + r.w - 1 && ty < r.y0 + r.h - 1;
}
