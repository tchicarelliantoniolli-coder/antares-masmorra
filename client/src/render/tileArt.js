import { makeCanvas, px, circle, shade, hash, outline } from './pixel.js';
import { THEMES } from '/shared/sim/constants.js';

/**
 * Tileset dos cenários da escola. Cada tema ocupa uma linha com 8 tiles de 32x32:
 *   0 chão A | 1 chão B | 2 topo da parede | 3 frente da parede | 4 obstáculo | 5 chão C | 6-7 reservados
 */
export const TILESET_COLS = 8;
export const TILE_KIND = { FLOOR_A: 0, FLOOR_B: 1, WALL_TOP: 2, WALL_FACE: 3, OBSTACLE: 4, FLOOR_C: 5 };

const PALETTES = {
  sala_aula:   { floor: '#c7955c', line: '#a87a46', wall: '#efe3c4', wallTrim: '#3f7a4a', top: '#4a3b2e' },
  laboratorio: { floor: '#e7eef2', line: '#cbd5db', wall: '#b9dcd8', wallTrim: '#5a9a96', top: '#3d5560' },
  quadra:      { floor: '#d9733f', line: '#f4efe6', wall: '#3c64b0', wallTrim: '#f2c94c', top: '#22355e' },
  biblioteca:  { floor: '#8c3b3b', line: '#7a3030', wall: '#7a5232', wallTrim: '#5a3a22', top: '#3b2617' },
  patio:       { floor: '#a9a59b', line: '#8d897f', wall: '#b65a3c', wallTrim: '#d98a6a', top: '#5a3a2e' },
  secretaria:  { floor: '#5b6c88', line: '#4e5d77', wall: '#d8d0bc', wallTrim: '#8a7a5a', top: '#3a3f4f' },
  corredor:    { floor: '#d6c7a2', line: '#c2b28d', wall: '#e9dcae', wallTrim: '#4a7bd8', top: '#4a4436' }
};

export function buildTileset() {
  const [sheet, ctx] = makeCanvas(TILESET_COLS * 32, THEMES.length * 32);
  THEMES.forEach((theme, row) => {
    const pal = PALETTES[theme];
    const draw = (kind, fn) => {
      const [c, cctx] = makeCanvas(32, 32);
      fn(cctx, pal, theme);
      ctx.drawImage(c, kind * 32, row * 32);
    };
    draw(0, (c) => floor(c, pal, theme, 0));
    draw(1, (c) => floor(c, pal, theme, 1));
    draw(5, (c) => floor(c, pal, theme, 2));
    draw(2, (c) => wallTop(c, pal));
    draw(3, (c) => wallFace(c, pal, theme));
    draw(4, (c) => { floor(c, pal, theme, 0); obstacle(c, pal, theme); });
  });
  return sheet;
}

function noise(c, base, amount, seed) {
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, seed, 3) * 32), y = Math.floor(hash(seed, i, 7) * 32);
    px(c, x, y, 1, 1, shade(base, (hash(x, y, seed) - 0.5) * amount));
  }
}

function floor(c, p, theme, v) {
  px(c, 0, 0, 32, 32, p.floor);
  switch (theme) {
    case 'sala_aula':
      for (let y = 0; y < 32; y += 8) {
        px(c, 0, y, 32, 1, p.line);
        const off = (y / 8) % 2 ? 6 : 20;
        px(c, off, y, 1, 8, p.line);
      }
      if (v === 1) { px(c, 12, 3, 3, 2, shade(p.floor, -0.2)); }
      noise(c, p.floor, 0.15, 11 + v);
      break;
    case 'laboratorio':
      px(c, 0, 0, 16, 16, p.floor); px(c, 16, 16, 16, 16, p.floor);
      px(c, 16, 0, 16, 16, p.line); px(c, 0, 16, 16, 16, p.line);
      if (v === 1) px(c, 4, 22, 3, 2, '#9be27a');
      break;
    case 'quadra':
      noise(c, p.floor, 0.12, 21 + v);
      if (v === 1) px(c, 0, 14, 32, 3, p.line);
      if (v === 2) px(c, 14, 0, 3, 32, p.line);
      break;
    case 'biblioteca':
      for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 32; x += 8) px(c, x + 2, y + 2, 3, 3, p.line);
      if (v === 1) px(c, 10, 10, 12, 12, shade(p.floor, 0.08));
      break;
    case 'patio':
      px(c, 0, 15, 32, 2, p.line); px(c, v === 1 ? 8 : 20, 0, 2, 15, p.line); px(c, v === 1 ? 24 : 4, 17, 2, 15, p.line);
      noise(c, p.floor, 0.18, 31 + v);
      if (v === 2) { px(c, 6, 6, 2, 2, '#5aa04a'); px(c, 8, 5, 1, 1, '#5aa04a'); }
      break;
    case 'secretaria':
      noise(c, p.floor, 0.25, 41 + v);
      noise(c, p.floor, 0.25, 51 + v);
      if (v === 1) px(c, 0, 0, 32, 1, p.line);
      break;
    case 'corredor':
      px(c, 0, 0, 32, 1, p.line); px(c, 0, 0, 1, 32, p.line); px(c, 16, 0, 1, 32, p.line); px(c, 0, 16, 32, 1, p.line);
      if (v === 1) px(c, 20, 20, 4, 4, shade(p.floor, -0.08));
      break;
  }
}

function wallTop(c, p) {
  px(c, 0, 0, 32, 32, p.top);
  px(c, 0, 0, 32, 1, shade(p.top, 0.2));
  noise(c, p.top, 0.2, 77);
}

function wallFace(c, p, theme) {
  px(c, 0, 0, 32, 32, p.wall);
  px(c, 0, 0, 32, 4, shade(p.top, 0.1));
  px(c, 0, 26, 32, 6, shade(p.wall, -0.25));
  px(c, 0, 26, 32, 1, p.wallTrim);
  switch (theme) {
    case 'sala_aula':
      px(c, 0, 10, 32, 2, p.wallTrim);
      break;
    case 'laboratorio':
      for (let y = 4; y < 26; y += 7) px(c, 0, y, 32, 1, shade(p.wall, -0.1));
      for (let x = 0; x < 32; x += 8) px(c, x, 4, 1, 22, shade(p.wall, -0.1));
      break;
    case 'quadra':
      px(c, 0, 14, 32, 3, p.wallTrim);
      break;
    case 'biblioteca':
      for (let x = 2; x < 32; x += 10) px(c, x, 6, 7, 18, shade(p.wall, -0.12));
      break;
    case 'patio':
      for (let y = 4; y < 26; y += 5) {
        px(c, 0, y, 32, 1, p.wallTrim);
        const off = (y / 5) % 2 ? 0 : 8;
        for (let x = off; x < 32; x += 16) px(c, x, y, 1, 5, p.wallTrim);
      }
      break;
    case 'secretaria':
      px(c, 6, 8, 18, 12, '#c8a26a'); px(c, 9, 10, 4, 4, '#fbfbf3'); px(c, 15, 11, 5, 3, '#ffd23f');
      break;
    case 'corredor':
      // armários (lockers)
      for (let x = 1; x < 32; x += 10) {
        px(c, x, 5, 9, 21, p.wallTrim);
        px(c, x, 5, 9, 1, shade(p.wallTrim, 0.3));
        px(c, x + 2, 8, 5, 1, shade(p.wallTrim, -0.3));
        px(c, x + 2, 10, 5, 1, shade(p.wallTrim, -0.3));
        px(c, x + 7, 15, 1, 3, '#d8d8d8');
      }
      break;
  }
}

function obstacle(c, p, theme) {
  const [o, octx] = makeCanvas(32, 32);
  switch (theme) {
    case 'sala_aula': // carteira escolar
      px(octx, 6, 18, 2, 10, '#5a4a3a'); px(octx, 24, 18, 2, 10, '#5a4a3a');
      px(octx, 3, 10, 26, 9, '#d9a066'); px(octx, 3, 10, 26, 2, '#f0c08a'); px(octx, 3, 18, 26, 2, '#a8743e');
      px(octx, 8, 12, 8, 4, '#fbfbf3'); px(octx, 18, 13, 6, 1, '#3a6fd8');
      break;
    case 'laboratorio': // bancada com frasco
      px(octx, 3, 12, 26, 16, '#7d8a94'); px(octx, 2, 9, 28, 5, '#9aa7b0'); px(octx, 2, 9, 28, 1, '#c9d1d9');
      px(octx, 8, 2, 4, 8, '#bfe9ff'); px(octx, 8, 6, 4, 3, '#7be04a'); px(octx, 18, 4, 6, 6, '#bfe9ff'); px(octx, 18, 7, 6, 3, '#ff6b9a');
      break;
    case 'quadra': // cones
      for (const x of [5, 18]) {
        px(octx, x + 3, 6, 3, 4, '#ff7a1a'); px(octx, x + 2, 10, 5, 4, '#f4efe6'); px(octx, x + 1, 14, 7, 6, '#ff7a1a'); px(octx, x, 20, 9, 3, '#d9531a');
      }
      break;
    case 'biblioteca': // estante
      px(octx, 2, 2, 28, 28, '#6a4426');
      for (let y = 4; y < 28; y += 8) {
        for (let x = 4; x < 28; x += 3) px(octx, x, y, 2, 6, ['#d94a4a', '#3a6fd8', '#f2c94c', '#3ac46a', '#b366ff'][(x + y) % 5]);
        px(octx, 3, y + 6, 26, 2, '#4a2e18');
      }
      break;
    case 'patio': // floreira
      px(octx, 4, 18, 24, 11, '#b65a3c'); px(octx, 4, 18, 24, 2, '#d98a6a');
      circle(octx, 11, 13, 6, '#3a8a3a'); circle(octx, 20, 12, 7, '#4aa04a'); circle(octx, 16, 9, 5, '#5ab85a');
      px(octx, 13, 8, 2, 2, '#ff8fb1'); px(octx, 21, 10, 2, 2, '#ffd23f');
      break;
    case 'secretaria': // arquivo de aço
      px(octx, 5, 2, 22, 27, '#8f98a3'); px(octx, 5, 2, 22, 2, '#b8bfc7');
      for (let y = 6; y < 28; y += 7) { px(octx, 7, y, 18, 5, '#a3acb6'); px(octx, 13, y + 2, 6, 1, '#3a3f4f'); }
      break;
    default:
      px(octx, 4, 4, 24, 24, '#8a6a4a');
  }
  outline(octx, 32, 32);
  c.drawImage(o, 0, 0);
}
