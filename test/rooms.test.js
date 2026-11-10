import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../shared/sim/rng.js';
import { World } from '../shared/sim/World.js';
import { generateFloor } from '../shared/sim/salas/DungeonGenerator.js';
import { spawnWave, freeCells } from '../shared/sim/salas/RoomDirector.js';
import { applyLayout, layoutOrder, reservedSet } from '../shared/sim/salas/layouts.js';
import { applyShape, pickShape } from '../shared/sim/salas/formas.js';
import { LAYOUT_NAMES, SHAPE_NAMES, PROP_KINDS, DECOR_WIDTH } from '../shared/sim/salas/kinds.js';
import { TileMap } from '../shared/sim/salas/TileMap.js';
import { serializeMap, buildMirrorMap } from '../shared/net/snapshot.js';
import { T, THEMES, TILE, INTERACT_RADIUS } from '../shared/sim/constants.js';
import { data } from './helpers.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inRect = (r, x, y) => x >= r.x0 && y >= r.y0 && x < r.x0 + r.w && y < r.y0 + r.h;
const interior = (r, x, y) => x > r.x0 && y > r.y0 && x < r.x0 + r.w - 1 && y < r.y0 + r.h - 1;

/** Andar com todos os temas possíveis nas salas de combate (para cobrir os 10 cenários). */
const floorAllThemes = (n) => ({ ...data.floor(n), themes: [...THEMES] });
/** Dados com a forma das salas de combate forçada. */
const withShape = (shape) => ({ themes: data.themes, roomShapes: { combat: { [shape]: 1 } } });

/** Chão alcançável (FLOOR/DOOR, caixas e obstáculos bloqueiam) a partir de (sx, sy), sem sair da sala. */
function reach(map, r, sx, sy) {
  const seen = new Set([sx + ',' + sy]);
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
      if (seen.has(k) || !inRect(r, nx, ny)) continue;
      const t = map.get(nx, ny);
      if (t !== T.FLOOR && t !== T.DOOR) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

function checkRoom(map, r, ctx) {
  const where = `${ctx} sala ${r.id} (${r.type}/${r.theme}/${r.shape}/${r.layout})`;
  assert.ok(SHAPE_NAMES.includes(r.shape), `${where}: forma desconhecida`);
  if (r.type !== 'combat') assert.equal(r.shape, 'retangulo', `${where}: sala especial deve ser retangular`);
  assert.ok(r.doors.length >= 1, `${where}: sem portas`);

  // portas e a boca delas (5 de largura x 3 de fundo) ficam livres: nada de parede, móvel, caixa ou espinho
  for (const d of r.doors) {
    for (let o = -1; o <= 1; o++) {
      const x = d.dir === 'N' || d.dir === 'S' ? d.tx + o : d.tx;
      const y = d.dir === 'N' || d.dir === 'S' ? d.ty : d.ty + o;
      assert.equal(map.get(x, y), T.DOOR, `${where}: tile da porta ${d.dir} virou ${map.get(x, y)}`);
    }
  }
  for (const k of reservedSet(r)) {
    const [x, y] = k.split(',').map(Number);
    assert.equal(map.get(x, y), T.FLOOR, `${where}: boca da porta bloqueada em ${k}`);
    assert.ok(!map.traps.some((t) => t.tx === x && t.ty === y), `${where}: espinho na boca da porta`);
  }

  // todas as portas alcançáveis e >= 90% do chão alcançável a partir da primeira porta
  const seen = reach(map, r, r.doors[0].tx, r.doors[0].ty);
  for (const d of r.doors) assert.ok(seen.has(d.tx + ',' + d.ty), `${where}: porta ${d.dir} inalcançável`);
  let chao = 0, alcancado = 0;
  for (let y = r.y0 + 1; y < r.y0 + r.h - 1; y++) for (let x = r.x0 + 1; x < r.x0 + r.w - 1; x++) {
    if (map.get(x, y) !== T.FLOOR) continue;
    chao++;
    if (seen.has(x + ',' + y)) alcancado++;
  }
  assert.ok(alcancado >= chao * 0.9, `${where}: só ${alcancado}/${chao} de chão alcançável`);
  if (r.type === 'combat') assert.ok(chao >= 70, `${where}: pouco chão (${chao})`);

  // centro livre (menos no layout 'centro'), paredes de forma só dentro da sala
  if (r.layout !== 'centro') assert.equal(map.get(r.cx, r.cy), T.FLOOR, `${where}: centro bloqueado`);
  for (let y = r.y0; y < r.y0 + r.h; y++) for (let x = r.x0; x < r.x0 + r.w; x++) {
    if (!interior(r, x, y)) continue;
    const t = map.get(x, y);
    assert.ok(t === T.FLOOR || t === T.WALL || t === T.OBSTACLE || t === T.PROP, `${where}: tile estranho ${t} em ${x},${y}`);
  }

  // decoração: lâmpada em todas as salas, sem sobreposição, só peças do tema, 2-4 peças no combate
  const decor = map.decor.filter((d) => d.ty === r.y0 && d.tx > r.x0 && d.tx < r.x0 + r.w - 1).sort((a, b) => a.tx - b.tx);
  assert.ok(decor.some((d) => d.kind === 'lampada'), `${where}: sem lâmpada`);
  const permitidas = new Set([...data.themes[r.theme].wallDecor, 'lampada']);
  for (let i = 0; i < decor.length; i++) {
    const d = decor[i];
    assert.ok(permitidas.has(d.kind), `${where}: decoração ${d.kind} não é do tema`);
    assert.equal(d.w, DECOR_WIDTH[d.kind], `${where}: largura errada de ${d.kind}`);
    for (let k = 0; k < d.w; k++) {
      assert.equal(map.get(d.tx + k, r.y0), T.WALL, `${where}: ${d.kind} fora da parede`);
      assert.equal(map.get(d.tx + k, r.y0 + 1), T.FLOOR, `${where}: ${d.kind} sobre parede de forma`);
    }
    if (i > 0) assert.ok(d.tx >= decor[i - 1].tx + decor[i - 1].w, `${where}: decorações sobrepostas`);
  }
  if (r.type === 'combat' && (r.shape === 'retangulo' || r.shape === 'cantos_cortados')) {
    assert.ok(decor.length >= 2 && decor.length <= 4, `${where}: ${decor.length} peças de decoração`);
  }
  assert.ok(decor.length <= 5, `${where}: decoração demais`);

  // objetos quebráveis: do tema (+ barril), 4 de vida (barril 2), sobre chão da própria sala
  if (r.type === 'combat') {
    const kindsOk = new Set([...Object.keys(data.themes[r.theme].props), 'barril']);
    for (let y = r.y0 + 1; y < r.y0 + r.h - 1; y++) for (let x = r.x0 + 1; x < r.x0 + r.w - 1; x++) {
      if (map.get(x, y) !== T.PROP) continue;
      const p = map.props.get(map.idx(x, y));
      assert.ok(PROP_KINDS.includes(p.kind) && kindsOk.has(p.kind), `${where}: objeto ${p.kind} fora do tema`);
      assert.equal(p.hp, p.kind === 'barril' ? 2 : 4);
      assert.equal(p.maxHp, p.hp);
    }
  }
}

test('10 temas x 5 formas x 3 andares: portas, bocas e chão alcançáveis, decoração sem sobreposição', () => {
  const formasVistas = new Set();
  const temasVistos = new Set();
  for (let floor = 1; floor <= 3; floor++) {
    for (let seed = 1; seed <= 60; seed++) {
      const { map, rooms } = generateFloor({ rng: new RNG(seed * 7 + floor), floorDef: floorAllThemes(floor), data });
      for (const r of rooms) {
        checkRoom(map, r, `andar ${floor} seed ${seed}`);
        if (r.type === 'combat') { formasVistas.add(r.shape); temasVistos.add(r.theme); }
      }
    }
  }
  assert.deepEqual([...formasVistas].sort(), [...SHAPE_NAMES].sort());
  assert.deepEqual([...temasVistos].sort(), [...THEMES].sort());
});

test('cada forma, forçada em todas as salas de combate, mantém as salas jogáveis', () => {
  for (const shape of SHAPE_NAMES) {
    for (let seed = 1; seed <= 25; seed++) {
      const floor = (seed % 3) + 1;
      const { map, rooms } = generateFloor({ rng: new RNG(1000 + seed), floorDef: floorAllThemes(floor), data: withShape(shape) });
      for (const r of rooms) {
        checkRoom(map, r, `forma ${shape} seed ${seed}`);
        if (r.type === 'combat') assert.equal(r.shape, shape);
      }
    }
  }
});

test('formas recortam o interior (menos chão que o retângulo) e deixam a cruz central livre', () => {
  for (const shape of SHAPE_NAMES) {
    const rng = new RNG(5);
    const m = new TileMap(60, 60);
    const r = { id: 0, theme: 'sala_aula', x0: 10, y0: 10, w: 21, h: 17, cx: 20, cy: 18 };
    for (let y = r.y0; y < r.y0 + r.h; y++) for (let x = r.x0; x < r.x0 + r.w; x++) m.set(x, y, interior(r, x, y) ? T.FLOOR : T.WALL, 0, 0);
    const cortados = applyShape(rng, m, r, shape);
    if (shape === 'retangulo') assert.equal(cortados, 0);
    else assert.ok(cortados >= 30, `${shape}: só ${cortados} tiles cortados`);
    for (let d = -2; d <= 2; d++) {
      assert.equal(m.get(r.cx + d, r.cy), T.FLOOR, `${shape}: eixo horizontal bloqueado`);
      assert.equal(m.get(r.cx, r.cy + d), T.FLOOR, `${shape}: eixo vertical bloqueado`);
    }
  }
  assert.equal(pickShape(new RNG(1), {}), 'retangulo');
  assert.equal(pickShape(new RNG(1), { L: 1 }), 'L');
  assert.equal(pickShape(new RNG(1), { inexistente: 5 }), 'retangulo');
});

test('em 200 sementes aparecem várias formas e muitos layouts diferentes', () => {
  const formas = new Set(), layouts = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const { rooms } = generateFloor({ rng: new RNG(seed), floorDef: data.floor((seed % 3) + 1), data });
    for (const r of rooms.filter((x) => x.type === 'combat')) { formas.add(r.shape); layouts.add(r.layout); }
  }
  assert.ok(formas.size >= 4, 'formas: ' + [...formas]);
  assert.ok(layouts.size >= 10, 'layouts: ' + [...layouts]);
  for (const l of layouts) assert.ok(LAYOUT_NAMES.includes(l), 'layout fora de kinds.js: ' + l);
});

test('cada tema de combate usa pelo menos 2 dos layouts dele (sorteio ponderado de themes.json)', () => {
  for (const theme of THEMES) {
    const pesos = data.themes[theme].combatLayouts;
    const usados = new Set();
    for (let seed = 1; seed <= 80; seed++) {
      const fd = { ...data.floor((seed % 3) + 1), themes: [theme] };
      const { rooms } = generateFloor({ rng: new RNG(seed), floorDef: fd, data });
      for (const r of rooms.filter((x) => x.type === 'combat')) if (pesos[r.layout]) usados.add(r.layout);
    }
    assert.ok(usados.size >= Math.min(2, Object.keys(pesos).length), `${theme}: só usou ${[...usados]} de ${Object.keys(pesos)}`);
  }
});

test('o layout mais pesado do tema é o mais sorteado', () => {
  const rng = new RNG(42);
  const pesos = data.themes.sala_aula.combatLayouts;
  const primeiro = {};
  for (let i = 0; i < 2000; i++) { const o = layoutOrder(rng, pesos); primeiro[o[0]] = (primeiro[o[0]] || 0) + 1; }
  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  const esperado = (pesos.carteiras / total) * 2000;
  assert.ok(Math.abs(primeiro.carteiras - esperado) < 0.08 * 2000, `carteiras ${primeiro.carteiras} vs esperado ${esperado}`);
  // a ordem tem todos os layouts, sem repetir, com 'aberto' disponível como último recurso
  const ordem = layoutOrder(new RNG(1), pesos);
  assert.equal(new Set(ordem).size, ordem.length);
  assert.deepEqual([...ordem].sort(), [...LAYOUT_NAMES].sort());
});

test('todos os layouts de kinds.js estão implementados e respeitam o centro e a boca das portas', () => {
  for (const nome of LAYOUT_NAMES) {
    for (const [w, h] of [[19, 15], [21, 17], [23, 19]]) {
      const r = {
        id: 0, theme: 'sala_aula', w, h, x0: 5, y0: 5, cx: 5 + Math.floor(w / 2), cy: 5 + Math.floor(h / 2),
        doors: [{ dir: 'N', tx: 5 + Math.floor(w / 2), ty: 5 }, { dir: 'S', tx: 5 + Math.floor(w / 2), ty: 5 + h - 1 },
          { dir: 'W', tx: 5, ty: 5 + Math.floor(h / 2) }, { dir: 'E', tx: 5 + w - 1, ty: 5 + Math.floor(h / 2) }]
      };
      const reservado = reservedSet(r);
      const colocados = [];
      const put = (x, y, tipo) => {
        if (!interior(r, x, y) || x === r.x0 + 1 || x === r.x0 + w - 2 || y === r.y0 + 1 || y === r.y0 + h - 2) return false;
        if (reservado.has(x + ',' + y)) return false;
        colocados.push([x, y, tipo]);
        return true;
      };
      applyLayout(nome, r, put, new RNG(w * h));
      if (nome === 'aberto') assert.equal(colocados.length, 0);
      else assert.ok(colocados.length >= 4, `${nome} ${w}x${h}: só ${colocados.length} tiles`);
      if (nome !== 'centro') assert.ok(!colocados.some(([x, y]) => x === r.cx && y === r.cy), `${nome}: bloqueou o centro`);
    }
  }
});

test('inimigos só nascem em chão da sala (T.FLOOR), também nas salas com forma', () => {
  for (const shape of SHAPE_NAMES) {
    for (let seed = 1; seed <= 12; seed++) {
      const w = new World({ data: Object.assign(Object.create(data), { roomShapes: { combat: { [shape]: 1 } } }), seed, floor: (seed % 3) + 1,
        players: [{ id: 'a', characterId: 'harilson' }, { id: 'b', characterId: 'marina' }] });
      for (const r of w.rooms.filter((x) => x.type === 'combat')) {
        assert.equal(r.shape, shape);
        const cells = freeCells(w, r, 2);
        assert.ok(cells.length >= 20, `${shape} seed ${seed}: poucas células (${cells.length})`);
        for (const [x, y] of cells) assert.equal(w.map.get(x, y), T.FLOOR);
        w.enemies = [];
        for (let i = 0; i < r.waves.length; i++) {
          spawnWave(w, r, i);
          for (const e of w.enemies.filter((q) => q.roomId === r.id)) {
            const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
            assert.equal(w.map.get(tx, ty), T.FLOOR, `${shape} seed ${seed} sala ${r.id}: inimigo em ${w.map.get(tx, ty)} (${tx},${ty})`);
            assert.ok(interior(r, tx, ty), 'inimigo fora da sala');
          }
          w.enemies = [];
        }
      }
    }
  }
});

test('baú, enfermaria, estátua, itens da loja e portal do chefe são alcançáveis a partir de qualquer porta', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const floor = (seed % 3) + 1;
    const w = new World({ data, seed, floor, players: [{ id: 'a', characterId: 'harilson' }] });
    for (const r of w.rooms.filter((x) => x.type !== 'combat' && x.type !== 'start')) {
      const alvos = w.pickups.filter((k) => ['chest', 'heal_station', 'statue', 'shop_item'].includes(k.kind) && inRect(r, Math.floor(k.x / TILE), Math.floor(k.y / TILE)));
      if (r.type === 'boss') alvos.push({ kind: 'portal', x: (r.cx + 0.5) * TILE, y: (r.cy + 2.5) * TILE, r: 20 });
      if (r.type === 'chest') assert.equal(alvos.filter((k) => k.kind === 'chest').length, 1);
      if (r.type === 'shop') assert.equal(alvos.filter((k) => k.kind === 'shop_item').length, 4);
      for (const k of alvos) {
        const tx = Math.floor(k.x / TILE), ty = Math.floor(k.y / TILE);
        assert.equal(w.map.get(tx, ty), T.FLOOR, `seed ${seed} ${r.type}: ${k.kind} em tile ${w.map.get(tx, ty)}`);
        for (const d of r.doors) {
          const seen = reach(w.map, r, d.tx, d.ty);
          const perto = [...seen].some((s) => {
            const [x, y] = s.split(',').map(Number);
            return w.map.get(x, y) === T.FLOOR && Math.hypot((x + 0.5) * TILE - k.x, (y + 0.5) * TILE - k.y) <= INTERACT_RADIUS + k.r - 6;
          });
          assert.ok(perto, `seed ${seed} andar ${floor}: ${k.kind} da sala ${r.type} inalcançável pela porta ${d.dir}`);
        }
      }
    }
  }
});

test('salas especiais têm composição própria (móveis) e continuam retangulares', () => {
  const contagem = { start: 0, chest: 0, heal: 0, statue: 0, shop: 0, boss: 0 };
  for (let seed = 1; seed <= 40; seed++) {
    const { map, rooms } = generateFloor({ rng: new RNG(seed), floorDef: data.floor((seed % 3) + 1), data });
    for (const r of rooms.filter((x) => x.type !== 'combat')) {
      assert.equal(r.shape, 'retangulo');
      let moveis = 0;
      for (let y = r.y0 + 1; y < r.y0 + r.h - 1; y++) for (let x = r.x0 + 1; x < r.x0 + r.w - 1; x++) if (map.get(x, y) === T.OBSTACLE) moveis++;
      assert.ok(moveis >= 4 || r.type === 'chest', `seed ${seed}: sala ${r.type} sem móveis`);
      if (moveis) contagem[r.type]++;
    }
  }
  for (const [tipo, n] of Object.entries(contagem)) assert.ok(n > 0, `nenhuma sala ${tipo} mobiliada`);
});

test('mesma semente gera o mesmo andar (formas, layouts, objetos e decoração)', () => {
  for (const seed of [3, 41, 777]) {
    const a = generateFloor({ rng: new RNG(seed), floorDef: floorAllThemes(2), data });
    const b = generateFloor({ rng: new RNG(seed), floorDef: floorAllThemes(2), data });
    assert.deepEqual([...a.map.tiles], [...b.map.tiles]);
    assert.deepEqual(a.map.serialize(), b.map.serialize());
    assert.deepEqual(a.rooms.map((r) => [r.shape, r.layout, r.theme]), b.rooms.map((r) => [r.shape, r.layout, r.theme]));
  }
  const w1 = new World({ data, seed: 9, players: [{ id: 'a', characterId: 'harilson' }] });
  const w2 = new World({ data, seed: 9, players: [{ id: 'a', characterId: 'harilson' }] });
  assert.deepEqual(serializeMap(w1), serializeMap(w2));
});

test('a forma da sala viaja no mapa serializado (modo online)', () => {
  const w = new World({ data, seed: 21, floor: 3, players: [{ id: 'a', characterId: 'harilson' }] });
  const msg = JSON.parse(JSON.stringify(serializeMap(w)));
  assert.ok(msg.rooms.every((r) => SHAPE_NAMES.includes(r.shape)));
  const espelho = buildMirrorMap(data, msg);
  assert.deepEqual(espelho.rooms.map((r) => r.shape), w.rooms.map((r) => r.shape));
  assert.deepEqual(espelho.rooms.map((r) => r.layout), w.rooms.map((r) => r.layout));
  assert.deepEqual([...espelho.map.tiles], [...w.map.tiles]);
  assert.deepEqual(espelho.map.decor, w.map.decor);
});

test('objetos do tema quebram como caixa e o barril continua explodindo', async () => {
  const { damageProp } = await import('../shared/sim/salas/Props.js');
  const kinds = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const g = generateFloor({ rng: new RNG(seed), floorDef: floorAllThemes(2), data });
    for (const p of g.map.props.values()) kinds.add(p.kind);
  }
  assert.ok(kinds.size >= 8, 'poucos tipos de objeto: ' + [...kinds]);
  assert.ok(kinds.has('barril') && kinds.has('caixa') && kinds.has('mochila'));
  // quebra um objeto do tema (não-barril) e confere o evento, o tile virando chão e que não explode
  const w = new World({ data, seed: 5, players: [{ id: 'a', characterId: 'harilson' }] });
  let quebrado = false;
  for (const [idx, p] of w.map.props) {
    if (p.kind === 'barril') continue;
    const tx = idx % w.map.w, ty = Math.floor(idx / w.map.w);
    damageProp(w, tx, ty, 99);
    assert.equal(w.map.get(tx, ty), T.FLOOR);
    assert.equal(w.map.props.has(idx), false);
    assert.ok(w.events.some((e) => e.type === 'prop_break' && e.kind === p.kind));
    assert.ok(!w.areas.length, 'objeto comum não deve explodir');
    quebrado = true;
    break;
  }
  assert.ok(quebrado);
});
