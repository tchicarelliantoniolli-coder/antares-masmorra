import { makeCanvas, px, dots, circle, shade, hash, outline } from './pixel.js';
import { THEMES, T } from '/shared/sim/constants.js';

/**
 * Tileset dos cenários da escola. Cada tema ocupa uma linha com 8 tiles de 32x32:
 *   0 chão A | 1 chão B | 2 topo da parede | 3 frente da parede | 4 obstáculo A | 5 chão C | 6 chão D (desgaste) | 7 obstáculo B
 * A escolha de qual variante vai em cada tile é por hash da posição (WorldRenderer.tileIndex), igual em todos os clientes.
 * Os obstáculos (4 e 7) têm fundo transparente: o WorldRenderer os desenha numa camada acima do piso/decalques/sombras.
 */
export const TILESET_COLS = 8;
export const TILE_KIND = { FLOOR_A: 0, FLOOR_B: 1, WALL_TOP: 2, WALL_FACE: 3, OBSTACLE: 4, FLOOR_C: 5, FLOOR_D: 6, OBSTACLE_B: 7 };

const PALETTES = {
  sala_aula:   { floor: '#c7955c', line: '#a87a46', wall: '#efe3c4', wallTrim: '#3f7a4a', top: '#4a3b2e' },
  laboratorio: { floor: '#e7eef2', line: '#cbd5db', wall: '#b9dcd8', wallTrim: '#5a9a96', top: '#3d5560' },
  quadra:      { floor: '#d9733f', line: '#f4efe6', wall: '#3c64b0', wallTrim: '#f2c94c', top: '#22355e' },
  biblioteca:  { floor: '#8c3b3b', line: '#7a3030', wall: '#7a5232', wallTrim: '#5a3a22', top: '#3b2617' },
  patio:       { floor: '#a9a59b', line: '#8d897f', wall: '#b65a3c', wallTrim: '#d98a6a', top: '#5a3a2e' },
  secretaria:  { floor: '#5b6c88', line: '#4e5d77', wall: '#d8d0bc', wallTrim: '#8a7a5a', top: '#3a3f4f' },
  corredor:    { floor: '#d6c7a2', line: '#c2b28d', wall: '#e9dcae', wallTrim: '#4a7bd8', top: '#4a4436' },
  orientacao:  { floor: '#7aa08a', line: '#6a907a', wall: '#f0dfe8', wallTrim: '#b07ad0', top: '#4a3a5a' },
  coordenacao: { floor: '#7a2a2a', line: '#6a2020', wall: '#5a3a26', wallTrim: '#c9a227', top: '#2a1a12' },
  cantina:     { floor: '#f0e8d8', line: '#e03a3a', wall: '#f6f0e0', wallTrim: '#e03a3a', top: '#5a3a2e' }
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
    draw(TILE_KIND.FLOOR_A, (c) => floor(c, pal, theme, 0));
    draw(TILE_KIND.FLOOR_B, (c) => floor(c, pal, theme, 1));
    draw(TILE_KIND.FLOOR_C, (c) => floor(c, pal, theme, 2));
    draw(TILE_KIND.FLOOR_D, (c) => floor(c, pal, theme, 3));
    draw(TILE_KIND.WALL_TOP, (c) => wallTop(c, pal));
    draw(TILE_KIND.WALL_FACE, (c) => wallFace(c, pal, theme));
    // obstáculos: fundo transparente (vão numa camada própria sobre piso, decalques e sombras)
    draw(TILE_KIND.OBSTACLE, (c) => obstacle(c, pal, theme, 0));
    draw(TILE_KIND.OBSTACLE_B, (c) => obstacle(c, pal, theme, 1));
  });
  return sheet;
}

function noise(c, base, amount, seed) {
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, seed, 3) * 32), y = Math.floor(hash(seed, i, 7) * 32);
    px(c, x, y, 1, 1, shade(base, (hash(x, y, seed) - 0.5) * amount));
  }
}

/** Retângulo com transparência (para manchas e desgaste sobre o piso). */
function tint(c, x, y, w, h, color, alpha) {
  c.globalAlpha = alpha;
  px(c, x, y, w, h, color);
  c.globalAlpha = 1;
}

/** Mancha arredondada translúcida (elipse de pixels). */
function blot(c, cx, cy, rx, ry, color, alpha) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    if ((x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) <= 1) c.fillRect(cx + x, cy + y, 1, 1);
  }
  c.globalAlpha = 1;
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
      if (v === 2) { px(c, 4, 10, 10, 1, shade(p.floor, 0.12)); px(c, 18, 25, 9, 1, shade(p.floor, 0.12)); }
      if (v === 3) { // tábua gasta: trecho clareado, arranhões e um nó na madeira
        tint(c, 2, 9, 28, 6, shade(p.floor, 0.18), 0.5);
        dots(c, [[6, 11], [7, 12], [8, 12], [9, 13], [20, 10], [21, 11], [22, 11]], shade(p.floor, -0.25));
        blot(c, 24, 21, 2, 1, shade(p.floor, -0.3), 0.8);
        px(c, 10, 28, 4, 1, shade(p.floor, 0.2));
      }
      break;
    case 'laboratorio':
      px(c, 0, 0, 16, 16, p.floor); px(c, 16, 16, 16, 16, p.floor);
      px(c, 16, 0, 16, 16, p.line); px(c, 0, 16, 16, 16, p.line);
      if (v === 1) px(c, 4, 22, 3, 2, '#9be27a');
      if (v === 2) { px(c, 20, 4, 6, 1, shade(p.line, -0.12)); px(c, 20, 5, 1, 3, shade(p.line, -0.12)); }
      if (v === 3) { // ladrilho rachado com mancha de produto químico
        blot(c, 9, 22, 5, 3, '#9db8c8', 0.55);
        dots(c, [[19, 3], [20, 4], [20, 5], [21, 6], [22, 6], [23, 7], [23, 8], [24, 9]], shade(p.line, -0.3));
        dots(c, [[21, 6], [20, 7], [19, 8]], shade(p.line, -0.3));
        px(c, 0, 15, 32, 1, shade(p.line, -0.08));
      }
      break;
    case 'quadra':
      noise(c, p.floor, 0.12, 21 + v);
      if (v === 1) { for (let x = 3; x < 32; x += 8) px(c, x, 15, 5, 1, shade(p.floor, 0.2)); noise(c, p.floor, 0.22, 25); } // tinta desbotada em risquinhos
      if (v === 2) { tint(c, 6, 8, 20, 14, shade(p.floor, 0.1), 0.45); px(c, 18, 5, 1, 6, shade(p.floor, -0.2)); }
      if (v === 3) { // marcas de borracha dos tênis e tinta descascada
        for (let i = 0; i < 4; i++) px(c, 4 + i * 3, 22 - i * 4, 7, 1, shade(p.floor, -0.35));
        tint(c, 18, 4, 9, 5, shade(p.floor, 0.18), 0.6);
        dots(c, [[22, 14], [23, 14], [24, 15], [10, 6], [11, 7]], shade(p.floor, -0.2));
      }
      break;
    case 'biblioteca':
      for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 32; x += 8) px(c, x + 2, y + 2, 3, 3, p.line);
      if (v === 1) px(c, 10, 10, 12, 12, shade(p.floor, 0.08));
      if (v === 2) { px(c, 0, 15, 32, 2, shade(p.floor, -0.12)); }
      if (v === 3) { // carpete puído: trilha clara onde todo mundo anda e uma manchinha
        blot(c, 16, 15, 13, 6, shade(p.floor, 0.12), 0.65); blot(c, 16, 15, 8, 3, shade(p.floor, 0.1), 0.5);
        for (let x = 5; x < 28; x += 4) px(c, x, 11 + ((x / 4) % 2) * 7, 2, 1, shade(p.floor, 0.25));
        blot(c, 24, 25, 3, 2, shade(p.floor, -0.35), 0.5);
      }
      break;
    case 'patio':
      px(c, 0, 15, 32, 2, p.line); px(c, v === 1 ? 8 : 20, 0, 2, 15, p.line); px(c, v === 1 ? 24 : 4, 17, 2, 15, p.line);
      noise(c, p.floor, 0.18, 31 + v);
      if (v === 2) { px(c, 6, 6, 2, 2, '#5aa04a'); px(c, 8, 5, 1, 1, '#5aa04a'); }
      if (v === 3) { // junta rachada com mato nascendo
        dots(c, [[12, 3], [13, 4], [13, 5], [14, 6], [15, 7], [15, 8], [16, 9], [17, 10], [17, 11], [18, 12], [19, 13], [20, 14]], shade(p.floor, -0.45));
        px(c, 9, 8, 2, 3, '#5aa04a'); px(c, 11, 6, 1, 3, '#7ac05a'); px(c, 8, 7, 1, 2, '#4a8a3a');
        px(c, 25, 22, 2, 2, '#5aa04a'); px(c, 24, 21, 1, 2, '#7ac05a');
        blot(c, 8, 25, 3, 2, shade(p.floor, -0.2), 0.5);
      }
      break;
    case 'secretaria':
      noise(c, p.floor, 0.25, 41 + v);
      noise(c, p.floor, 0.25, 51 + v);
      if (v === 1) px(c, 0, 0, 32, 1, p.line);
      if (v === 2) { px(c, 0, 31, 32, 1, p.line); px(c, 31, 0, 1, 32, p.line); }
      if (v === 3) { // carpete com mancha de café e marca de cadeira
        blot(c, 21, 11, 4, 3, '#3e3a48', 0.55); blot(c, 21, 11, 2, 1, '#2e2a36', 0.6);
        for (const [x, y] of [[6, 22], [11, 24], [8, 27], [4, 26]]) px(c, x, y, 2, 2, shade(p.floor, -0.2));
      }
      break;
    case 'corredor':
      px(c, 0, 0, 32, 1, p.line); px(c, 0, 0, 1, 32, p.line); px(c, 16, 0, 1, 32, p.line); px(c, 0, 16, 32, 1, p.line);
      if (v === 1) px(c, 20, 20, 4, 4, shade(p.floor, -0.08));
      if (v === 2) { tint(c, 2, 2, 13, 13, shade(p.floor, 0.1), 0.7); }
      if (v === 3) { // lajota quebrada e suja
        dots(c, [[19, 18], [20, 19], [21, 20], [21, 21], [22, 22], [23, 23], [24, 24], [24, 25], [25, 26]], shade(p.line, -0.4));
        dots(c, [[22, 22], [21, 23], [20, 24]], shade(p.line, -0.4));
        blot(c, 8, 8, 4, 3, shade(p.floor, -0.18), 0.6);
        tint(c, 17, 17, 14, 14, shade(p.floor, -0.05), 0.5);
      }
      break;
    case 'orientacao': // tapete macio verde com flores
      noise(c, p.floor, 0.12, 61 + v);
      if (v === 1) { px(c, 10, 10, 3, 3, '#ffd0e0'); px(c, 11, 11, 1, 1, '#ffd23f'); }
      if (v === 2) px(c, 0, 0, 32, 2, p.line);
      if (v === 3) { // flores e folhinhas bordadas no tapete
        for (const [x, y] of [[6, 7], [22, 18]]) {
          px(c, x, y - 2, 3, 1, '#ffd0e0'); px(c, x - 2, y - 1, 7, 3, '#ffd0e0'); px(c, x, y + 2, 3, 1, '#ffd0e0'); px(c, x + 1, y, 1, 1, '#ffd23f');
        }
        px(c, 14, 14, 3, 1, '#5a8a6a'); px(c, 15, 13, 1, 3, '#5a8a6a');
        px(c, 4, 24, 3, 1, '#5a8a6a'); px(c, 5, 23, 1, 3, '#5a8a6a');
      }
      break;
    case 'coordenacao': // carpete vermelho com borda dourada
      noise(c, p.floor, 0.15, 71 + v);
      if (v === 1) { for (let i = 0; i < 4; i++) { px(c, 16 - i, 12 + i, 1, 1, '#b08a20'); px(c, 16 + i, 12 + i, 1, 1, '#b08a20'); px(c, 16 - i, 20 - i, 1, 1, '#b08a20'); px(c, 16 + i, 20 - i, 1, 1, '#b08a20'); } }
      if (v === 2) { dots(c, [[8, 8], [24, 8], [8, 24], [24, 24], [16, 16]], '#b08a20'); }
      if (v === 3) { // desenho em losango + trilha de uso mais escura
        for (let i = 0; i < 8; i++) { px(c, 16 - i, 8 + i, 1, 1, '#9a7a1a'); px(c, 16 + i, 8 + i, 1, 1, '#9a7a1a'); px(c, 16 - i, 24 - i, 1, 1, '#9a7a1a'); px(c, 16 + i, 24 - i, 1, 1, '#9a7a1a'); }
        px(c, 15, 15, 3, 3, '#c9a227');
        tint(c, 0, 0, 32, 32, '#000000', 0.07);
      }
      break;
    case 'cantina': // piso xadrez vermelho e branco
      px(c, 0, 0, 16, 16, p.floor); px(c, 16, 16, 16, 16, p.floor);
      px(c, 16, 0, 16, 16, '#d84a4a'); px(c, 0, 16, 16, 16, '#d84a4a');
      if (v === 1) { px(c, 2, 2, 5, 1, '#e8dfc8'); px(c, 18, 19, 4, 1, '#c03a3a'); }
      if (v === 2) { px(c, 0, 15, 32, 1, '#e0d6bc'); px(c, 15, 0, 1, 32, '#e0d6bc'); }
      if (v === 3) { // ladrilho lascado e engordurado
        blot(c, 7, 8, 4, 3, '#d8c8a0', 0.6); blot(c, 23, 24, 3, 2, '#a83030', 0.5);
        dots(c, [[3, 14], [4, 15], [5, 15], [26, 3], [27, 4]], '#b8a888');
      }
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
    case 'orientacao':
      px(c, 0, 12, 32, 2, p.wallTrim);
      px(c, 6, 15, 6, 8, '#9be27a'); px(c, 20, 16, 5, 6, '#ffd0e0');
      break;
    case 'coordenacao':
      for (let x = 2; x < 32; x += 10) px(c, x, 6, 8, 18, shade(p.wall, -0.15));
      px(c, 0, 4, 32, 1, p.wallTrim);
      break;
    case 'cantina':
      for (let x = 0; x < 32; x += 8) for (let y = 6; y < 26; y += 8) px(c, x, y, 7, 7, (x + y) % 16 ? '#ffffff' : '#ffd0d0');
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

// ------------------------------------------------------------------ obstáculos (2 variantes por tema)
// Cada obstáculo ocupa o tile inteiro com ~1px de folga nas bordas: em fileira, as unidades ficam separadas por uma
// linha escura fina (carteiras lado a lado, módulos de estante, mesas emendadas) e continuam bonitas sozinhas.

/** Silhueta escura do objeto deslocada para baixo/direita: sombra de contato assada no próprio tile (o resto vai pela camada de sombras). */
function contactShadow(c, o, dx = 3, dy = 4, alpha = 0.3) {
  const [s, sctx] = makeCanvas(32, 32);
  sctx.drawImage(o, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = '#120a24';
  sctx.fillRect(0, 0, 32, 32);
  c.globalAlpha = alpha;
  c.drawImage(s, dx, dy);
  c.globalAlpha = 1;
}

function obstacle(c, p, theme, v) {
  const [o, g] = makeCanvas(32, 32);
  const draw = OBSTACLES[theme] || obstacleBanco;
  draw(g, v, p);
  outline(g, 32, 32);
  contactShadow(c, o);
  c.drawImage(o, 0, 0);
}

/** Carteira escolar: tampo, cadeira azul/verde e material em cima. */
function obstacleCarteira(g, v) {
  const chair = v ? ['#3ac46a', '#6fe39a', '#25904a'] : ['#3a6fd8', '#6f9cf0', '#2a4fa8'];
  px(g, 5, 19, 2, 6, '#4a4f5c'); px(g, 25, 19, 2, 6, '#4a4f5c'); // pés de metal
  px(g, 4, 17, 24, 3, '#9b7440');                                  // saia do tampo
  px(g, 3, 5, 26, 12, '#f1e2bd');                                  // tampo
  px(g, 3, 5, 26, 1, '#fffaf0'); px(g, 3, 15, 26, 2, '#c9ab75');
  px(g, 9, 20, 14, 6, chair[0]); px(g, 9, 20, 14, 1, chair[1]);   // assento
  px(g, 9, 26, 14, 3, chair[2]);                                   // encosto
  if (!v) {
    px(g, 6, 7, 10, 7, '#fbfbf3'); px(g, 11, 7, 1, 7, '#c9c9d4');  // caderno aberto
    for (let y = 9; y < 14; y += 2) { px(g, 7, y, 3, 1, '#7aa6e8'); px(g, 13, y, 2, 1, '#7aa6e8'); }
    px(g, 19, 8, 7, 2, '#ffd23f'); px(g, 25, 8, 2, 2, '#ff8fa3'); px(g, 19, 8, 1, 2, '#3a3f4f'); // lápis
  } else {
    px(g, 5, 8, 10, 6, '#d94a4a'); px(g, 5, 8, 10, 1, '#f08080'); px(g, 5, 13, 10, 1, '#fbfbf3'); // livro vermelho
    px(g, 7, 6, 8, 3, '#3a6fd8');                                                                  // livro azul por cima
    px(g, 18, 8, 9, 5, '#8a4ab0'); px(g, 18, 8, 9, 1, '#b07ad0'); px(g, 18, 10, 9, 1, '#5a2a80'); // estojo
  }
}

/** Bancada de laboratório: tampo escuro de epóxi, armário embaixo e vidrarias. */
function obstacleBancada(g, v) {
  px(g, 3, 17, 26, 12, '#8fa0ac');                   // armário
  px(g, 3, 27, 26, 2, '#4a5a66');                    // rodapé
  px(g, 15, 18, 2, 9, '#5a6a76');                    // fresta entre as portas
  px(g, 12, 21, 2, 3, '#2b2b33'); px(g, 18, 21, 2, 3, '#2b2b33');
  px(g, 2, 9, 28, 9, '#3c4a54');                     // tampo
  px(g, 2, 9, 28, 1, '#8a9ba7'); px(g, 2, 16, 28, 2, '#6b7c88');
  if (!v) {
    px(g, 6, 3, 5, 3, '#bfe9ff'); px(g, 5, 6, 7, 4, '#bfe9ff'); px(g, 5, 8, 7, 2, '#e85aa0'); px(g, 7, 2, 3, 1, '#9aa0a6');  // erlenmeyer rosa
    for (let i = 0; i < 3; i++) { px(g, 17 + i * 4, 3, 3, 7, '#bfe9ff'); px(g, 17 + i * 4, 6 - (i % 2), 3, 4 + (i % 2), ['#7a8ae8', '#f2c94c', '#e85aa0'][i]); } // tubos
    px(g, 16, 10, 14, 1, '#6a7a86');
  } else {
    px(g, 5, 8, 8, 2, '#2b2b33'); px(g, 7, 2, 4, 7, '#c9d1d9'); px(g, 5, 4, 3, 2, '#8a9ba7'); px(g, 11, 4, 3, 2, '#2b2b33'); // microscópio
    px(g, 20, 6, 6, 4, '#6a7a86'); px(g, 22, 3, 2, 4, '#9aa0a6'); px(g, 22, 1, 2, 2, '#4ab0ff'); px(g, 23, 0, 1, 1, '#bfe9ff'); // bico de Bunsen
    px(g, 15, 7, 3, 3, '#fbfbf3'); px(g, 15, 7, 3, 1, '#c9c9d4');                                                                // anotação
  }
}

/** Cones de treino: dois cones listrados (A) ou três cones pequenos em triângulo (B). */
function cone(g, x, y, w, h, color = '#ff7a1a') {
  // x,y = canto superior esquerdo da base; o cone sobe a partir dela
  px(g, x, y + h - 3, w, 3, '#d9531a');              // base
  const bodyW = Math.max(3, w - 2);
  for (let i = 0; i < h - 3; i++) {
    const t = i / (h - 4);
    const ww = Math.max(2, Math.round(2 + (bodyW - 2) * t));
    const xx = x + Math.floor((w - ww) / 2);
    const stripe = i > (h - 3) * 0.35 && i < (h - 3) * 0.6;
    px(g, xx, y + i, ww, 1, stripe ? '#f4efe6' : color);
    px(g, xx, y + i, 1, 1, shade(stripe ? '#f4efe6' : color, 0.3));
  }
}
function obstacleCones(g, v) {
  if (!v) {
    cone(g, 3, 8, 11, 20); cone(g, 17, 6, 12, 22);
    px(g, 4, 28, 9, 1, '#d9531a'); px(g, 18, 28, 10, 1, '#d9531a');
  } else {
    cone(g, 10, 1, 11, 13);
    cone(g, 3, 16, 11, 13); cone(g, 18, 16, 11, 13);
  }
}

/** Estante de livros: módulo de madeira com 3 prateleiras de lombadas variadas. */
function obstacleEstante(g, v) {
  const cols = ['#d94a4a', '#3a6fd8', '#f2c94c', '#3ac46a', '#b366ff', '#ff8a3a', '#e8e0c8'];
  px(g, 1, 1, 30, 30, '#6a4426');                     // moldura
  px(g, 1, 1, 30, 3, '#9a6a3a'); px(g, 1, 1, 30, 1, '#c28a52'); // tampo iluminado
  px(g, 3, 4, 26, 25, '#2e1a0c');                     // fundo escuro
  for (let r = 0; r < 3; r++) {
    const y = 5 + r * 8;                              // topo da prateleira
    let x = 4;
    let i = 0;
    while (x < 27) {
      const k = hash(x + r * 13, r, v ? 91 : 55);
      const w = 2 + Math.floor(k * 3);
      const h = 5 + Math.floor(hash(r, x, 7 + v) * 3);
      const color = cols[Math.floor(hash(x, r, 31 + v * 5) * cols.length)];
      if (v && r === 1 && x > 14 && x < 21) { x += 1; i++; continue; } // espaço vazio com objeto (variante B)
      px(g, x, y + 7 - h, w, h, color); px(g, x, y + 7 - h, 1, h, shade(color, 0.25)); px(g, x + w - 1, y + 8 - h, 1, h - 1, shade(color, -0.25));
      x += w + (k > 0.8 ? 1 : 0);
      i++;
    }
    px(g, 3, y + 7, 26, 2, '#4a2e18'); px(g, 3, y + 7, 26, 1, '#7a4e2a'); // prancha
  }
  if (v) { // variante B: globo e planta no vão do meio
    circle(g, 17, 18, 3, '#3a8cd8'); px(g, 15, 17, 3, 2, '#5ab85a'); px(g, 17, 21, 1, 2, '#c9a227'); px(g, 15, 23, 5, 1, '#c9a227');
    px(g, 24, 3, 3, 2, '#5ab85a'); px(g, 25, 2, 1, 1, '#7ae07a');
  }
}

/** Floreira de tijolos com arbustos e flores. */
function obstacleFloreira(g, v) {
  px(g, 2, 16, 28, 14, '#b65a3c');                    // caixa de tijolos
  px(g, 2, 16, 28, 2, '#d98a6a'); px(g, 2, 28, 28, 2, '#8a3e26');
  for (let y = 20; y < 28; y += 4) { px(g, 3, y, 26, 1, '#8a3e26'); for (let x = (y / 4) % 2 ? 6 : 10; x < 29; x += 8) px(g, x, y - 3, 1, 3, '#8a3e26'); }
  px(g, 3, 16, 26, 3, '#5a3a22');                     // terra
  if (!v) {
    circle(g, 9, 12, 6, '#3a8a3a'); circle(g, 22, 11, 7, '#4aa04a'); circle(g, 15, 8, 5, '#5ab85a');
    circle(g, 8, 10, 2, '#6ad06a'); circle(g, 20, 8, 2, '#6ad06a');
    px(g, 12, 6, 2, 2, '#ff8fb1'); px(g, 21, 10, 2, 2, '#ffd23f'); px(g, 6, 12, 2, 2, '#ff8fb1'); px(g, 25, 13, 2, 2, '#ff8fb1');
  } else {
    circle(g, 7, 12, 5, '#2f7a3a'); circle(g, 15, 10, 6, '#3a8a4a'); circle(g, 24, 12, 6, '#2f7a3a');
    for (const [x, y] of [[6, 9], [14, 6], [20, 9], [25, 11], [10, 12]]) { px(g, x - 1, y, 3, 1, '#ffffff'); px(g, x, y - 1, 1, 3, '#ffffff'); px(g, x, y, 1, 1, '#ffd23f'); }
    px(g, 17, 12, 3, 3, '#e03a3a'); px(g, 18, 11, 1, 1, '#ff7a7a'); px(g, 4, 14, 3, 2, '#e03a3a');
  }
}

/** Vaso grande de planta (sala da orientação). */
function obstacleVaso(g, v) {
  const pot = v ? ['#e8e8f0', '#fbfbff', '#a8a8bc'] : ['#c98b4a', '#e0a868', '#9a6a30'];
  px(g, 8, 19, 16, 11, pot[0]); px(g, 7, 18, 18, 3, pot[1]); px(g, 8, 27, 16, 3, pot[2]);
  if (v) px(g, 8, 23, 16, 2, '#7aa6e8');
  px(g, 8, 20, 16, 1, '#4a3a22');
  if (!v) {
    circle(g, 16, 11, 8, '#4aa04a'); circle(g, 10, 14, 5, '#3a8a3a'); circle(g, 22, 14, 5, '#3a8a3a'); circle(g, 12, 8, 4, '#5ab85a'); circle(g, 20, 7, 3, '#6ad06a');
    px(g, 15, 10, 1, 6, '#2f7a3a');
  } else {
    px(g, 15, 5, 2, 14, '#2f7a3a');
    for (const [x, y, w] of [[7, 6, 8], [17, 5, 8], [5, 11, 9], [18, 11, 9], [9, 15, 6], [18, 16, 6]]) { px(g, x, y, w, 3, '#3ac46a'); px(g, x, y, w, 1, '#7ae09a'); }
    circle(g, 16, 4, 3, '#ff8fb1'); px(g, 16, 3, 1, 2, '#ffd23f');
  }
}

/** Mesa de reunião: tampo de madeira envernizada com papéis, cadeiras escuras na frente. */
function obstacleMesa(g, v) {
  px(g, 3, 25, 4, 5, '#3a2412'); px(g, 25, 25, 4, 5, '#3a2412'); // pés
  px(g, 1, 6, 30, 19, '#8a5a32');                                 // tampo
  px(g, 1, 6, 30, 1, '#c08a52'); px(g, 1, 7, 1, 17, '#a8733f');
  px(g, 1, 20, 30, 5, '#5a3418'); px(g, 1, 20, 30, 1, '#3a2412'); // aba frontal
  px(g, 3, 9, 26, 1, '#9a6a3a'); px(g, 3, 17, 26, 1, '#7a4a28'); // veio da madeira
  if (!v) {
    px(g, 4, 10, 8, 7, '#f4efe0'); px(g, 5, 12, 6, 1, '#9aa0a6'); px(g, 5, 14, 5, 1, '#9aa0a6'); px(g, 5, 10, 6, 1, '#e03a3a'); // ata
    px(g, 20, 10, 4, 4, '#fbfbf3'); px(g, 24, 11, 2, 2, '#fbfbf3'); px(g, 20, 14, 4, 1, '#c9a227');                             // xícara e plaquinha
    px(g, 14, 12, 3, 1, '#3a6fd8');
  } else {
    px(g, 5, 9, 10, 7, '#2b2b33'); px(g, 6, 10, 8, 5, '#4ab0ff'); px(g, 4, 16, 12, 2, '#3a3f4f');   // notebook
    px(g, 19, 10, 8, 6, '#f4efe0'); px(g, 20, 11, 6, 1, '#9aa0a6'); px(g, 20, 13, 4, 1, '#9aa0a6');   // papéis
    px(g, 22, 8, 1, 3, '#e03a3a');
  }
}

/** Balcão da cantina: tampo de inox, frente vermelha e comida. */
function obstacleBalcao(g, v) {
  px(g, 1, 14, 30, 15, '#c0443a');                    // frente
  px(g, 1, 14, 30, 1, '#e86a5a'); px(g, 1, 20, 30, 2, '#f6f0e0'); px(g, 1, 27, 30, 2, '#6a2a26');
  px(g, 1, 9, 30, 6, '#cfd6dc'); px(g, 1, 9, 30, 1, '#ffffff'); px(g, 1, 14, 30, 1, '#8a96a0'); // tampo de inox
  if (!v) {
    px(g, 4, 5, 8, 4, '#f6f0e0'); circle(g, 8, 4, 3, '#e03a3a'); px(g, 7, 2, 1, 1, '#ffffff');       // prato com maçã
    px(g, 15, 4, 5, 5, '#bfe9ff'); px(g, 15, 6, 5, 3, '#ff8a3a'); px(g, 16, 2, 1, 3, '#ffffff');     // copo de suco
    px(g, 23, 5, 6, 4, '#f2c94c'); px(g, 24, 3, 4, 2, '#e8a030');                                     // sanduíche
  } else {
    px(g, 4, 4, 10, 5, '#9aa0a6'); px(g, 5, 2, 8, 3, '#c9d1d9'); px(g, 8, 1, 2, 1, '#e0e0e0');         // panela
    px(g, 17, 5, 12, 4, '#c9a227'); px(g, 18, 3, 3, 3, '#e8c060'); px(g, 23, 3, 4, 3, '#e8c060'); px(g, 20, 2, 3, 2, '#f2d888'); // cesta de pães
  }
}

/** Arquivo de aço com gavetas. */
function obstacleArquivo(g, v) {
  const body = v ? ['#7d9a88', '#a8c4b2', '#5a7a68'] : ['#8f98a3', '#b8bfc7', '#6a737e'];
  px(g, 4, 3, 24, 27, body[0]);
  px(g, 4, 3, 24, 4, body[1]); px(g, 4, 6, 24, 1, body[2]);   // tampo
  px(g, 4, 28, 24, 2, body[2]);
  const rows = v ? [[9, 5], [15, 5], [21, 5], [26, 3]] : [[9, 6], [16, 6], [23, 6]];
  for (const [y, h] of rows) {
    px(g, 6, y, 20, h, shade(body[0], 0.12)); px(g, 6, y + h - 1, 20, 1, body[2]);
    px(g, 12, y + 1, 8, 2, '#fbfbf3'); px(g, 13, y + 2, 6, 1, '#9aa0a6');       // etiqueta
    px(g, 14, y + Math.min(h - 2, 4), 4, 1, '#2b2b33');                          // puxador
  }
  if (v) { px(g, 7, 1, 8, 3, '#f4efe0'); px(g, 8, 0, 6, 2, '#fbfbf3'); px(g, 19, 2, 5, 4, '#b65a3c'); px(g, 20, 0, 3, 3, '#4aa04a'); } // papéis e plantinha
}

/** Banco de corredor (usado se algum tema sem móvel próprio receber obstáculos). */
function obstacleBanco(g, v) {
  px(g, 4, 22, 3, 8, '#4a4f5c'); px(g, 25, 22, 3, 8, '#4a4f5c');
  const slat = v ? '#6aa0e0' : '#c89a5a';
  for (let y = 8; y < 22; y += 5) { px(g, 2, y, 28, 4, slat); px(g, 2, y, 28, 1, shade(slat, 0.3)); px(g, 2, y + 3, 28, 1, shade(slat, -0.3)); }
}

const OBSTACLES = {
  sala_aula: obstacleCarteira,
  laboratorio: obstacleBancada,
  quadra: obstacleCones,
  biblioteca: obstacleEstante,
  patio: obstacleFloreira,
  orientacao: obstacleVaso,
  coordenacao: obstacleMesa,
  cantina: obstacleBalcao,
  secretaria: obstacleArquivo,
  corredor: obstacleBanco
};

// ------------------------------------------------------------------ sombras no chão
// Tileset 'shadows': sombras translúcidas geradas por código, sobrepostas ao piso (camada própria no WorldRenderer).
// Luz vinda do alto à esquerda: a parede lança sombra para baixo e para a direita; os cantos internos escurecem.
// Cada tile de sombra é escolhido pela vizinhança do tile de chão (ver shadowIndexAt):
//   n, w, nw: o vizinho ao norte / oeste / noroeste é 0 = nada, 1 = parede (sombra longa), 2 = obstáculo (sombra curta)
//   e, s: vizinho a leste / sul é parede (só escurece a borda: oclusão ambiente)
//   blob: o tile tem caixa/barril por cima (sombra de contato embaixo do objeto)
export const SHADOW_COLS = 16;
const SHADOW_TOTAL = 3 * 3 * 3 * 2 * 2 * 2; // 216 combinações (o código 0 = sem sombra)
const SHADOW_RGB = [18, 10, 36];

function shadowCode(n, w, nw, e, s, blob) {
  return ((((n * 3 + w) * 3 + nw) * 2 + e) * 2 + s) * 2 + blob;
}
function shadowDecode(code) {
  const blob = code % 2; code = (code - blob) / 2;
  const s = code % 2; code = (code - s) / 2;
  const e = code % 2; code = (code - e) / 2;
  const nw = code % 3; code = (code - nw) / 3;
  const w = code % 3; code = (code - w) / 3;
  return { n: code, w, nw, e, s, blob };
}

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
/** Borda suave: d = distância para dentro do retângulo, b = largura do esmaecido. */
const soft = (d, b) => smooth(d / b + 0.5);
function boxCov(x, y, x0, y0, x1, y1, b) {
  return soft(x - x0, b) * soft(x1 - x, b) * soft(y - y0, b) * soft(y1 - y, b);
}

/** Opacidade (0..1) da sombra no pixel (x, y) do tile, para o código dado. */
function shadowAlpha(f, x, y) {
  const px_ = x + 0.5, py_ = y + 0.5;
  // 1) sombra lançada: o "bloco" vizinho deslocado para baixo/direita (soma de coberturas: costuras contínuas)
  const cast = (kind, ox, oy, b) => {
    let cov = 0;
    for (const [dx, dy, v] of [[0, -1, f.n], [-1, 0, f.w], [-1, -1, f.nw]]) {
      if (v === kind) cov += boxCov(px_, py_, dx * 32 + ox, dy * 32 + oy, dx * 32 + 32 + ox, dy * 32 + 32 + oy, b);
    }
    return Math.min(1, cov);
  };
  const wallCast = cast(1, 7, 12, 9) * 0.42;
  const objCast = cast(2, 3, 6, 5) * 0.3;
  let a = 1 - (1 - wallCast) * (1 - objCast);
  // 2) oclusão ambiente: encosto nas paredes escurece a borda do tile
  const ao = (d, len, k) => (d < len ? k * (1 - d / len) * (1 - d / len) : 0);
  if (f.n === 1) a = 1 - (1 - a) * (1 - ao(py_, 7, 0.22));
  if (f.w === 1) a = 1 - (1 - a) * (1 - ao(px_, 7, 0.2));
  if (f.e) a = 1 - (1 - a) * (1 - ao(32 - px_, 7, 0.2));
  if (f.s) a = 1 - (1 - a) * (1 - ao(32 - py_, 7, 0.2));
  // 3) cantos internos (duas paredes se encontrando) ficam mais escuros
  const corner = (cx, cy) => { const d = Math.hypot(px_ - cx, py_ - cy); return d < 13 ? 0.2 * Math.pow(1 - d / 13, 1.4) : 0; };
  if (f.n === 1 && f.w === 1) a = 1 - (1 - a) * (1 - corner(0, 0));
  if (f.n === 1 && f.e) a = 1 - (1 - a) * (1 - corner(32, 0));
  if (f.s && f.w === 1) a = 1 - (1 - a) * (1 - corner(0, 32));
  if (f.s && f.e) a = 1 - (1 - a) * (1 - corner(32, 32));
  // 4) sombra de contato da caixa/barril (elipse achatada, levemente para a direita)
  if (f.blob) {
    const d = Math.hypot((px_ - 17) / 14.5, (py_ - 26.5) / 6.2);
    const blob = 0.36 * (1 - smooth((d - 0.55) / 0.6));
    a = 1 - (1 - a) * (1 - blob);
  }
  return a;
}

export function buildShadowTileset() {
  const rows = Math.ceil(SHADOW_TOTAL / SHADOW_COLS);
  const W = SHADOW_COLS * 32, H = rows * 32;
  const [sheet, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let code = 1; code < SHADOW_TOTAL; code++) {
    const f = shadowDecode(code);
    const ox = (code % SHADOW_COLS) * 32, oy = Math.floor(code / SHADOW_COLS) * 32;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const a = shadowAlpha(f, x, y);
        if (a < 0.012) continue;
        const i = ((oy + y) * W + ox + x) * 4;
        d[i] = SHADOW_RGB[0]; d[i + 1] = SHADOW_RGB[1]; d[i + 2] = SHADOW_RGB[2]; d[i + 3] = Math.round(a * 255);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return sheet;
}

/**
 * Índice do tile de sombra para o tile (x, y) do mapa, ou -1 se não há sombra.
 * Só lê o mapa (tiles), então é igual em todos os clientes e pode ser chamada de novo quando uma caixa quebra.
 */
export function shadowIndexAt(map, x, y) {
  const t = map.get(x, y);
  if (t !== T.FLOOR && t !== T.PROP && t !== T.DOOR) return -1;
  const cls = (xx, yy) => { const k = map.get(xx, yy); return k === T.WALL ? 1 : k === T.OBSTACLE ? 2 : 0; };
  const code = shadowCode(cls(x, y - 1), cls(x - 1, y), cls(x - 1, y - 1), cls(x + 1, y) === 1 ? 1 : 0, cls(x, y + 1) === 1 ? 1 : 0, t === T.PROP ? 1 : 0);
  return code === 0 ? -1 : code;
}
