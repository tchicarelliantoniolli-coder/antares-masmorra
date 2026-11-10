import { T, THEME_INDEX } from '../constants.js';
import { SHAPE_NAMES } from './kinds.js';

/**
 * Formas das salas de combate (themes.json -> "shapes.combat").
 *
 * A sala continua sendo um retângulo na grade (x0, y0, w, h) e as portas ficam sempre no meio de cada lado.
 * A forma é feita "comendo" pedaços do interior com T.WALL (no tema da sala). Todo corte respeita:
 *  - a cruz central livre: nenhum corte entra em |dx| <= 2 nem em |dy| <= 2 (relativos ao centro), então
 *    as 4 portas sempre desembocam em chão que leva ao centro;
 *  - o centro (cx, cy) sempre é chão.
 * Os cortes são retângulos [dx0, dy0, dx1, dy1] relativos ao centro (inclusivos).
 */

const CORNERS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

/** Retângulo normalizado (aceita extremos em qualquer ordem). */
const rect = (x0, y0, x1, y1) => [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];

/** Sorteia o nome da forma a partir dos pesos (ex.: data.roomShapes.combat). Sem pesos = retângulo. */
export function pickShape(rng, weights) {
  const valid = {};
  for (const [name, w] of Object.entries(weights || {})) if (SHAPE_NAMES.includes(name) && w > 0) valid[name] = w;
  return Object.keys(valid).length ? rng.weighted(valid) : 'retangulo';
}

/**
 * Lista de retângulos de parede (relativos ao centro) para uma forma.
 * hw/hh = meia largura/altura do interior (o interior vai de -hw..hw e -hh..hh).
 */
export function shapeCuts(shape, rng, hw, hh) {
  const cuts = [];
  switch (shape) {
    case 'cantos_cortados': {
      // cantos chanfrados em escada: k tiles na borda, diminuindo 1 por linha
      const k = rng.int(3, 4);
      for (const [sx, sy] of CORNERS) {
        for (let j = 0; j < k; j++) cuts.push(rect(sx * (hw - (k - 1 - j)), sy * (hh - j), sx * hw, sy * (hh - j)));
      }
      break;
    }
    case 'L': {
      // um canto inteiro vira parede; as duas portas desse canto ficam livres
      const [sx, sy] = rng.pick(CORNERS);
      const ax = rng.int(3, 4), ay = rng.int(3, 4);
      cuts.push(rect(sx * ax, sy * ay, sx * hw, sy * hh));
      break;
    }
    case 'cruz': {
      const ax = rng.int(4, 5), ay = rng.int(3, 4);
      for (const [sx, sy] of CORNERS) cuts.push(rect(sx * ax, sy * ay, sx * hw, sy * hh));
      break;
    }
    case 'T': {
      // dois cantos do mesmo lado viram parede; sobra uma barra larga e uma "haste" para o lado oposto
      const lado = rng.pick(['N', 'S', 'E', 'W']);
      const ax = rng.int(3, 4), ay = rng.int(3, 4);
      for (const [sx, sy] of CORNERS) {
        if (lado === 'N' && sy !== 1) continue;   // barra no norte: cortes embaixo
        if (lado === 'S' && sy !== -1) continue;
        if (lado === 'W' && sx !== 1) continue;
        if (lado === 'E' && sx !== -1) continue;
        cuts.push(rect(sx * ax, sy * ay, sx * hw, sy * hh));
      }
      break;
    }
    default:
      break;
  }
  return cuts;
}

/**
 * Aplica a forma na sala (depois que o retângulo e os corredores já foram escavados).
 * `protegido(x, y)` = tiles que não podem virar parede (boca das portas). Devolve o número de tiles trocados.
 */
export function applyShape(rng, map, r, shape, protegido = () => false) {
  const hw = Math.floor((r.w - 2) / 2), hh = Math.floor((r.h - 2) / 2);
  if (shape === 'retangulo' || hw < 6 || hh < 5) return 0;
  const th = THEME_INDEX[r.theme] ?? 0;
  let n = 0;
  for (const [dx0, dy0, dx1, dy1] of shapeCuts(shape, rng, hw, hh)) {
    for (let dy = dy0; dy <= dy1; dy++) {
      for (let dx = dx0; dx <= dx1; dx++) {
        const x = r.cx + dx, y = r.cy + dy;
        if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;           // nunca na borda da sala
        if (Math.abs(dx) <= 2 || Math.abs(dy) <= 2) continue;            // nunca na cruz central
        if (map.get(x, y) !== T.FLOOR || protegido(x, y)) continue;
        map.set(x, y, T.WALL, r.id, th);
        n++;
      }
    }
  }
  return n;
}
