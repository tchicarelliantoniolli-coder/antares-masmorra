import { TILE, T } from '/shared/sim/constants.js';
import { DECAL_KINDS } from '/shared/sim/salas/kinds.js';
import { makeCanvas, hash, shade } from './pixel.js';

/**
 * Decalques de chão: tapetes, giz, folhas de papel, manchas, pegadas, poças, rachaduras, marcas de quadra...
 * Cada sala ganha 3-8 decalques sorteados de themes[tema].decals e desenhados UMA vez numa textura estática
 * (uma por sala), acima do piso e abaixo de tudo (sombras, caixas, espinhos, personagens).
 *
 * Tudo é determinístico: posição, tamanho e cores saem de hash(sala, índice) e só leem o mapa/salas (nada de RNG da
 * simulação), então o cliente online enxerga exatamente o mesmo chão. Os decalques ficam mais apagados (translúcidos,
 * sem brilho nem animação) que os perigos de verdade (espinhos, poças de ácido/fogo) para não confundir.
 */

export const DEPTH_DECALS = 0.4;

// ------------------------------------------------------------------ utilidades de desenho
/** Sorteador determinístico: cada chamada devolve o próximo número em [0, 1). */
function rngFrom(seed) {
  let n = 0;
  return () => hash(seed, n++, 977);
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, list) => list[Math.floor(r() * list.length)];

const dot = (g, x, y, w, h, color) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };

/** Linha de pixels (Bresenham). */
function line(g, x0, y0, x1, y1, color, w = 1) {
  g.fillStyle = color;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    g.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Mancha irregular (raio varia com o ângulo). */
function blob(g, cx, cy, rad, color, r, rough = 0.35) {
  g.fillStyle = color;
  const ph = [r() * 6, r() * 6, r() * 6];
  const k = [2 + Math.floor(r() * 2), 3 + Math.floor(r() * 2), 5];
  for (let y = -rad * 1.5; y <= rad * 1.5; y++) {
    for (let x = -rad * 1.5; x <= rad * 1.5; x++) {
      const a = Math.atan2(y, x);
      const rr = rad * (1 - rough + rough * (0.5 + 0.5 * Math.sin(a * k[0] + ph[0]) * 0.6 + 0.5 * Math.sin(a * k[1] + ph[1]) * 0.4 + 0.1 * Math.sin(a * k[2] + ph[2])));
      if (x * x + y * y <= rr * rr) g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
}

function ellipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
    if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
  }
}

// mini fonte 3x5 (dígitos) para os números da amarelinha e do giz
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function digit(g, ch, x, y, color, s = 2) {
  const bits = DIGITS[ch];
  g.fillStyle = color;
  for (let i = 0; i < 15; i++) if (bits[i] === '1') g.fillRect(x + (i % 3) * s, y + Math.floor(i / 3) * s, s, s);
}
function number(g, n, cx, cy, color, s = 2) {
  const str = String(n);
  const w = str.length * 3 * s + (str.length - 1) * s;
  str.split('').forEach((ch, i) => digit(g, +ch, Math.round(cx - w / 2 + i * 4 * s), Math.round(cy - 2.5 * s), color, s));
}

// ------------------------------------------------------------------ cada decalque: footprint (tiles), opacidade e desenho
// draw(g, w, h, r, theme): desenha em tons cheios num canvas w x h; a opacidade final é aplicada ao colar na sala.
const RUGS = {
  biblioteca: [['#5a1f2a', '#c9a227'], ['#1f4a3a', '#d8c890'], ['#1f2f5a', '#c9a227']],
  secretaria: [['#3e4a64', '#9aa7c0'], ['#4a5a48', '#d0d8c0'], ['#5a3e48', '#d8c0c8']],
  orientacao: [['#8a6aa8', '#f0dfe8'], ['#6a8aa8', '#f4efe0'], ['#a86a8a', '#f4dce8']],
  coordenacao: [['#1e2a4a', '#c9a227'], ['#3a1a1a', '#d8b040'], ['#2a3a2a', '#c9a227']]
};

function drawTapete(g, w, h, r, theme) {
  const [base, trim] = pick(r, RUGS[theme] || RUGS.secretaria);
  dot(g, 3, 3, w - 6, h - 6, shade(base, -0.35));            // sombra/borda externa
  dot(g, 4, 4, w - 8, h - 8, trim);                           // faixa clara da borda
  dot(g, 7, 7, w - 14, h - 14, base);                         // campo
  dot(g, 10, 10, w - 20, 1, shade(trim, -0.1)); dot(g, 10, h - 11, w - 20, 1, shade(trim, -0.1));
  dot(g, 10, 10, 1, h - 20, shade(trim, -0.1)); dot(g, w - 11, 10, 1, h - 20, shade(trim, -0.1));
  // losangos repetidos no campo
  const step = 12;
  for (let y = 16; y < h - 16; y += step) {
    for (let x = 16; x < w - 16; x += step) {
      dot(g, x, y - 2, 1, 1, shade(base, 0.25)); dot(g, x - 1, y - 1, 3, 1, shade(base, 0.25)); dot(g, x - 2, y, 5, 1, shade(base, 0.25));
      dot(g, x - 1, y + 1, 3, 1, shade(base, 0.25)); dot(g, x, y + 2, 1, 1, shade(base, 0.25));
    }
  }
  // medalhão central
  const cx = Math.round(w / 2), cy = Math.round(h / 2);
  ellipse(g, cx, cy, Math.min(14, h / 2 - 12), Math.min(9, h / 2 - 12), trim);
  ellipse(g, cx, cy, Math.min(11, h / 2 - 15), Math.min(6, h / 2 - 15), shade(base, -0.1));
  // franjas nas pontas
  for (let y = 6; y < h - 6; y += 3) { dot(g, 0, y, 3, 1, shade(trim, 0.2)); dot(g, w - 3, y, 3, 1, shade(trim, 0.2)); }
}

function drawGiz(g, w, h, r) {
  const c = pick(r, ['#f2f4f0', '#f2f4f0', '#ffe9a0', '#bfe0ff']);
  const motif = ri(r, 0, 3);
  if (motif === 0) { // conta
    const a = ri(r, 1, 9), b = ri(r, 1, 9);
    digit(g, a, 6, 10, c); line(g, 15, 15, 21, 15, c, 2); line(g, 18, 12, 18, 18, c, 2);
    digit(g, b, 25, 10, c); line(g, 34, 13, 40, 13, c, 2); line(g, 34, 17, 40, 17, c, 2);
    line(g, 46, 10, 49, 22, c); line(g, 52, 10, 55, 22, c);
  } else if (motif === 1) { // estrela e coração
    for (let i = 0; i < 5; i++) {
      const a0 = -Math.PI / 2 + i * 4 * Math.PI / 5, a1 = -Math.PI / 2 + (i + 1) * 4 * Math.PI / 5;
      line(g, 16 + Math.cos(a0) * 9, 16 + Math.sin(a0) * 9, 16 + Math.cos(a1) * 9, 16 + Math.sin(a1) * 9, c);
    }
    line(g, 44, 24, 36, 14, c); line(g, 36, 14, 38, 9, c); line(g, 38, 9, 44, 13, c); line(g, 44, 13, 50, 9, c); line(g, 50, 9, 52, 14, c); line(g, 52, 14, 44, 24, c);
  } else if (motif === 2) { // seta, xis e riscos
    line(g, 6, 18, 34, 18, c, 2); line(g, 34, 18, 28, 12, c, 2); line(g, 34, 18, 28, 24, c, 2);
    line(g, 42, 10, 54, 22, c, 2); line(g, 54, 10, 42, 22, c, 2);
  } else { // bonequinho
    for (let i = 0; i < 12; i++) dot(g, 16 + Math.round(Math.cos(i / 12 * 6.283) * 4), 9 + Math.round(Math.sin(i / 12 * 6.283) * 4), 1, 1, c);
    line(g, 16, 14, 16, 24, c); line(g, 16, 17, 10, 21, c); line(g, 16, 17, 22, 21, c); line(g, 16, 24, 11, 29, c); line(g, 16, 24, 21, 29, c);
    line(g, 32, 28, 54, 28, c); line(g, 34, 22, 40, 22, c); line(g, 44, 18, 52, 18, c);
  }
  // pó de giz
  for (let i = 0; i < 8; i++) dot(g, ri(r, 2, w - 3), ri(r, 2, h - 3), 1, 1, c);
}

function paper(g, cx, cy, ang, r, w = 12, h = 16, ink = '#9aa0b0') {
  g.save();
  g.translate(cx, cy);
  g.rotate(ang);
  g.fillStyle = 'rgba(20,10,30,0.35)'; g.fillRect(-w / 2 + 1, -h / 2 + 2, w, h);
  g.fillStyle = pick(r, ['#f6f2e4', '#fbfbf3', '#efe8d0', '#f4f0f8']); g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = ink;
  for (let y = -h / 2 + 3; y < h / 2 - 2; y += 3) g.fillRect(-w / 2 + 2, y, w - 4 - (r() < 0.3 ? 4 : 0), 1);
  if (r() < 0.35) { g.fillStyle = '#e03a3a'; g.fillRect(w / 2 - 5, -h / 2 + 1, 3, 2); }
  g.restore();
}
function drawPapeis(g, w, h, r) {
  const n = ri(r, 3, 5);
  for (let i = 0; i < n; i++) paper(g, 14 + r() * (w - 28), 14 + r() * (h - 28), (r() - 0.5) * 2.2, r);
}

function drawManchas(g, w, h, r, theme) {
  const col = { laboratorio: '#26343c', quadra: '#4a2a1c', patio: '#3a3428', cantina: '#6a4a28' }[theme] || '#2a201a';
  const n = ri(r, 2, 4);
  for (let i = 0; i < n; i++) blob(g, w * (0.3 + r() * 0.4), h * (0.3 + r() * 0.4), 6 + r() * Math.min(w, h) * 0.22, col, r, 0.45);
  for (let i = 0; i < 6; i++) dot(g, ri(r, 3, w - 4), ri(r, 3, h - 4), ri(r, 1, 2), 1, col);
}

function drawPegadas(g, w, h, r) {
  const horizontal = w >= h;
  const n = ri(r, 4, 6);
  const len = (horizontal ? w : h) - 20;
  const dirFlip = r() < 0.5 ? 1 : -1;
  const wob = (r() - 0.5) * 8;
  g.fillStyle = '#2a1e30';
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const side = i % 2 ? 1 : -1;
    const along = 10 + t * len;
    const across = (horizontal ? h : w) / 2 + side * 4 + wob * (t - 0.5);
    g.save();
    g.translate(horizontal ? (dirFlip > 0 ? along : w - along) : across, horizontal ? across : (dirFlip > 0 ? along : h - along));
    g.rotate((horizontal ? (dirFlip > 0 ? 0 : Math.PI) : (dirFlip > 0 ? Math.PI / 2 : -Math.PI / 2)) + (r() - 0.5) * 0.25);
    g.fillRect(0, -3, 7, 6);       // sola
    g.fillRect(7, -2, 3, 4);       // ponta
    g.fillRect(-6, -2, 4, 4);      // salto
    g.restore();
  }
}

const LIQUIDS = {
  // tons foscos de propósito: nada de verde ácido, laranja-fogo, ciano-gelo ou magenta vivo (cores dos perigos de verdade)
  laboratorio: ['#6a74b8', '#8a68a8', '#4a8a98', '#b8a050'],
  cantina: ['#e8d8b0', '#6a3a22', '#a8485e', '#6a74b8'],
  default: ['#6a74b8', '#8a68a8', '#a8485e']
};
function drawDerramado(g, w, h, r, theme) {
  const col = pick(r, LIQUIDS[theme] || LIQUIDS.default);
  blob(g, w * 0.5, h * 0.5, Math.min(w, h) * 0.3, shade(col, -0.2), r, 0.45);
  blob(g, w * 0.5 + 1, h * 0.5 - 1, Math.min(w, h) * 0.26, col, r, 0.4);
  for (let i = 0; i < 4; i++) { // respingos
    const a = r() * 6.283, d = Math.min(w, h) * (0.36 + r() * 0.14);
    ellipse(g, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, ri(r, 1, 2), ri(r, 1, 2), col);
  }
  dot(g, w * 0.42, h * 0.42, 6, 1, shade(col, 0.45)); dot(g, w * 0.42, h * 0.42 + 1, 2, 3, shade(col, 0.45)); // reflexo
}

function drawPoca(g, w, h, r) {
  const rx = w * 0.36, ry = h * 0.3;
  blob(g, w / 2, h / 2, Math.max(rx, ry), '#3a566e', r, 0.4);
  ellipse(g, w / 2 - 2, h / 2 - 1, Math.round(rx * 0.7), Math.round(ry * 0.65), '#5a7e9a');
  dot(g, w / 2 - rx * 0.5, h / 2 - ry * 0.4, rx * 0.5, 1, '#a8c8dc');
  dot(g, w / 2 + rx * 0.1, h / 2 + ry * 0.3, rx * 0.3, 1, '#a8c8dc');
}

function drawRachaduras(g, w, h, r) {
  const ink = '#1d1424';
  const walk = (x, y, ang, steps, depth) => {
    for (let i = 0; i < steps; i++) {
      ang += (r() - 0.5) * 1.1;
      const nx = x + Math.cos(ang) * (3 + r() * 3), ny = y + Math.sin(ang) * (3 + r() * 3);
      line(g, x, y, nx, ny, ink);
      x = nx; y = ny;
      if (x < 2 || y < 2 || x > w - 3 || y > h - 3) break;
      if (depth < 2 && r() < 0.22) walk(x, y, ang + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.5), ri(r, 3, 6), depth + 1);
    }
  };
  walk(w * (0.15 + r() * 0.2), h * (0.2 + r() * 0.6), r() * 1.2 - 0.1, ri(r, 8, 13), 0);
  if (r() < 0.6) walk(w * 0.5, h * 0.5, 2 + r() * 1.5, ri(r, 4, 7), 1);
}

function drawAmarelinha(g, w, h, r) {
  const c = pick(r, ['#f2f4f0', '#ffe9a0']);
  const vertical = h >= w;
  const cell = 26, gap = 2, pair = cell * 2 + gap;
  // (coluna, linha, número) dos 10 quadrados, de baixo para cima: 1, 2-3, 4, 5-6, 7, 8-9, 10
  const cells = [[0, 0, 1], [0, 1, 2], [1, 1, 3], [0, 2, 4], [0, 3, 5], [1, 3, 6], [0, 4, 7], [0, 5, 8], [1, 5, 9], [0, 6, 10]];
  for (const [col, row, n] of cells) {
    const single = ![2, 3, 5, 6, 8, 9].includes(n);
    const across = single ? (pair - cell) / 2 : col * (cell + gap);   // quadrados únicos ficam centralizados
    const along = row * (cell + gap);
    const x = Math.round(vertical ? 4 + across : 4 + along);
    const y = Math.round(vertical ? h - 4 - cell - along : 4 + across);
    g.fillStyle = c;
    g.fillRect(x, y, cell, 2); g.fillRect(x, y + cell - 2, cell, 2); g.fillRect(x, y, 2, cell); g.fillRect(x + cell - 2, y, 2, cell);
    number(g, n, x + cell / 2, y + cell / 2, c, n === 10 ? 2 : 3);
  }
}

function drawFolhas(g, w, h, r) {
  const cols = ['#c8742a', '#a8501c', '#d8a030', '#7a8a2a', '#8a4a1c'];
  const n = ri(r, 5, 9);
  for (let i = 0; i < n; i++) {
    const cx = 8 + r() * (w - 16), cy = 8 + r() * (h - 16), a = r() * 3.14;
    const col = pick(r, cols);
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, 6.283); g.fill();
    g.fillStyle = shade(col, -0.35); g.fillRect(-5, 0, 10, 1);
    g.restore();
  }
}

function drawMigalhas(g, w, h, r) {
  const n = ri(r, 9, 15);
  for (let i = 0; i < n; i++) {
    const x = 3 + r() * (w - 8), y = 3 + r() * (h - 8);
    dot(g, x, y, r() < 0.25 ? 3 : 2, r() < 0.25 ? 2 : 1, pick(r, ['#d8c090', '#e8d8a8', '#b89a68']));
  }
}

/** Marcas de quadra: linhas, círculo central e garrafões. Ocupa a sala inteira (recuada 4 tiles das paredes). */
function drawQuadra(g, w, h, r) {
  const line_ = '#f4efe6';
  const L = 4 * TILE + 2, Tp = 4 * TILE + 2, R = w - 4 * TILE - 2, B = h - 4 * TILE - 2;
  if (R - L < 4 * TILE || B - Tp < 3 * TILE) { // sala pequena: só círculo central e linha do meio
    g.strokeStyle = line_; g.lineWidth = 3;
    g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) * 0.18, 0, 6.283); g.stroke();
    g.fillStyle = line_; g.fillRect(w / 2 - 1, h / 2 - TILE * 2.2, 3, TILE * 4.4);
    return;
  }
  const cx = w / 2, cy = h / 2;
  const keyH = Math.min(5 * TILE, (B - Tp) * 0.5), keyW = Math.min(3.4 * TILE, (R - L) * 0.3);
  // pintura dos garrafões (azul da escola, bem apagado)
  g.fillStyle = '#a83a1a'; // lance livre pintado de tijolo (tom mais escuro que o piso laranja)
  g.fillRect(L, cy - keyH / 2, keyW, keyH); g.fillRect(R - keyW, cy - keyH / 2, keyW, keyH);
  g.strokeStyle = line_; g.fillStyle = line_; g.lineWidth = 3;
  g.strokeRect(L, Tp, R - L, B - Tp);                                // contorno
  g.fillRect(cx - 1, Tp, 3, B - Tp);                                 // linha do meio
  g.beginPath(); g.arc(cx, cy, Math.min(2 * TILE, (B - Tp) * 0.28), 0, 6.283); g.stroke(); // círculo central
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? L : R - keyW, xe = side < 0 ? L + keyW : R - keyW;
    g.strokeRect(x0, cy - keyH / 2, keyW, keyH);                    // garrafão
    g.beginPath(); g.arc(xe, cy, keyH * 0.3, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : -Math.PI / 2, false); g.stroke(); // lance livre
    g.beginPath(); g.arc(side < 0 ? L + 20 : R - 20, cy, 5, 0, 6.283); g.stroke(); // aro (marca)
  }
}

export const DECAL_DEFS = {
  tapete:       { alpha: 0.72, size: (r) => [ri(r, 4, 6), ri(r, 3, 4)], fallback: [[3, 2]], draw: drawTapete, unique: true },
  giz:          { alpha: 0.4, size: () => [2, 1], draw: drawGiz },
  papeis:       { alpha: 0.7, size: () => [2, 2], draw: drawPapeis, overlay: true },
  manchas:      { alpha: 0.26, size: (r) => (r() < 0.5 ? [1, 1] : [2, 2]), draw: drawManchas },
  pegadas:      { alpha: 0.3, size: (r) => (r() < 0.5 ? [4, 1] : [1, 4]), draw: drawPegadas },
  derramado:    { alpha: 0.38, size: () => [2, 2], draw: drawDerramado },
  poca:         { alpha: 0.42, size: (r) => (r() < 0.5 ? [2, 1] : [2, 2]), draw: drawPoca },
  rachaduras:   { alpha: 0.4, size: () => [2, 2], draw: drawRachaduras },
  marcas_quadra: { alpha: 0.46, room: true, draw: drawQuadra, unique: true },
  amarelinha:   { alpha: 0.5, size: (r) => (r() < 0.6 ? [2, 7] : [7, 2]), fallback: [[2, 7], [7, 2]], draw: drawAmarelinha, unique: true },
  folhas:       { alpha: 0.82, size: () => [2, 2], draw: drawFolhas, overlay: true },
  migalhas:     { alpha: 0.7, size: () => [2, 1], draw: drawMigalhas, overlay: true }
};

// ------------------------------------------------------------------ colocação
/** Tiles de chão reservados à frente das portas (mesma ideia do gerador: ninguém fica preso ao entrar). */
function doorZone(room) {
  const zone = new Set();
  for (const d of room.doors || []) {
    for (let k = 0; k <= 3; k++) {
      for (let o = -2; o <= 2; o++) {
        let x, y;
        if (d.dir === 'E') { x = d.tx - k; y = d.ty + o; }
        else if (d.dir === 'W') { x = d.tx + k; y = d.ty + o; }
        else if (d.dir === 'S') { x = d.tx + o; y = d.ty - k; }
        else { x = d.tx + o; y = d.ty + k; }
        zone.add(x + ',' + y);
      }
    }
  }
  return zone;
}

/**
 * Pinta os decalques de uma sala num canvas do tamanho dela (ou devolve null se o tema não tem decalques).
 * Só lê map/room: resultado idêntico em todos os clientes.
 */
export function paintRoomDecals(map, room, kinds) {
  kinds = (kinds || []).filter((k) => DECAL_DEFS[k] && DECAL_KINDS.includes(k));
  if (!kinds.length) return null;
  const seed = hash(room.id + 1, room.x0 * 131 + room.y0, room.w * 17 + room.h);
  const rr = rngFrom(seed);
  const zone = doorZone(room);
  const ix0 = room.x0 + 1, iy0 = room.y0 + 1, ix1 = room.x0 + room.w - 2, iy1 = room.y0 + room.h - 2;
  const trap = new Set(map.traps.map((t) => t.tx + ',' + t.ty));
  // livre = chão (ou caixa, que fica por cima do decalque) da própria sala, sem espinho e fora da zona das portas
  const free = (x, y) => {
    if (x < ix0 || y < iy0 || x > ix1 || y > iy1) return false;
    const t = map.get(x, y);
    if ((t !== T.FLOOR && t !== T.PROP) || map.owner[map.idx(x, y)] !== room.id) return false;
    return !trap.has(x + ',' + y) && !zone.has(x + ',' + y);
  };

  const [canvas, g] = makeCanvas(room.w * TILE, room.h * TILE);
  const interior = (room.w - 2) * (room.h - 2);
  const total = Math.min(8, 3 + Math.floor(rr() * 3) + (interior >= 200 ? 1 : 0) + (interior >= 330 ? 1 : 0) + (interior >= 480 ? 1 : 0));
  const claimed = new Map();
  const used = new Set();
  const start = Math.floor(rr() * kinds.length);
  let drawn = 0;
  const blit = (def, sheet, x, y) => {
    g.globalAlpha = def.alpha;
    g.drawImage(sheet, x, y);
    g.globalAlpha = 1;
  };

  for (let i = 0; i < total + 4 && drawn < total; i++) {
    const kind = kinds[(start + i) % kinds.length];
    const def = DECAL_DEFS[kind];
    if (def.unique && used.has(kind)) continue;
    const r = rngFrom(hash(seed, i, 5));
    if (def.room) { // marcas da quadra: cobrem a sala inteira
      const [sheet, sg] = makeCanvas(room.w * TILE, room.h * TILE);
      def.draw(sg, room.w * TILE, room.h * TILE, r, room.theme);
      blit(def, sheet, 0, 0);
      used.add(kind); drawn++;
      continue;
    }
    const sizes = [def.size(r), ...(def.fallback || [])];
    let placed = false;
    for (const [fw, fh] of sizes) {
      for (let attempt = 0; attempt < 16 && !placed; attempt++) {
        const tx = ix0 + Math.floor(r() * Math.max(1, ix1 - ix0 - fw + 2));
        const ty = iy0 + Math.floor(r() * Math.max(1, iy1 - iy0 - fh + 2));
        let ok = true;
        for (let y = ty; y < ty + fh && ok; y++) for (let x = tx; x < tx + fw && ok; x++) {
          if (!free(x, y)) ok = false;
          const c = claimed.get(x + ',' + y);
          if (c && !(def.overlay && c === 'tapete')) ok = false;
        }
        if (!ok) continue;
        const [sheet, sg] = makeCanvas(fw * TILE, fh * TILE);
        def.draw(sg, fw * TILE, fh * TILE, r, room.theme);
        blit(def, sheet, (tx - room.x0) * TILE, (ty - room.y0) * TILE);
        for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) if (!claimed.has(x + ',' + y)) claimed.set(x + ',' + y, kind);
        placed = true;
      }
      if (placed) break;
    }
    if (placed) { used.add(kind); drawn++; }
  }

  // apaga o que ficou em cima de parede, porta e na zona das portas (caixas e obstáculos ficam por cima: o decalque continua embaixo)
  for (let y = room.y0; y < room.y0 + room.h; y++) {
    for (let x = room.x0; x < room.x0 + room.w; x++) {
      const t = map.get(x, y);
      const ok = (t === T.FLOOR || t === T.PROP || t === T.OBSTACLE) && map.owner[map.idx(x, y)] === room.id && !zone.has(x + ',' + y);
      if (!ok) g.clearRect((x - room.x0) * TILE, (y - room.y0) * TILE, TILE, TILE);
    }
  }
  return canvas;
}

/**
 * Amostra de um decalque sobre o piso de um tema (usada pela galeria). tileset = canvas do buildTileset().
 * A marca de quadra é mostrada numa sala 19x15; os demais no tamanho natural.
 */
export function decalSample(kind, theme, themeRow, tileset, seed = 1) {
  const def = DECAL_DEFS[kind];
  const r = rngFrom(seed);
  const [fw, fh] = def.room ? [19, 15] : def.size(r);
  const [cv, g] = makeCanvas(fw * TILE, fh * TILE);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) g.drawImage(tileset, 0, themeRow * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  const [sheet, sg] = makeCanvas(fw * TILE, fh * TILE);
  def.draw(sg, fw * TILE, fh * TILE, r, theme);
  g.globalAlpha = def.alpha;
  g.drawImage(sheet, 0, 0);
  g.globalAlpha = 1;
  return cv;
}

/** Gerencia as texturas de decalques de todas as salas do andar (uma imagem estática por sala). */
export class FloorDecals {
  constructor(scene, world, data) {
    this.scene = scene;
    this.world = world;
    this.data = data;
    this.items = [];
  }

  build() {
    const { map, rooms } = this.world;
    const tm = this.scene.textures;
    for (const room of rooms) {
      const kinds = this.data?.themes?.[room.theme]?.decals;
      const canvas = paintRoomDecals(map, room, kinds);
      if (!canvas) continue;
      const key = 'decals_' + room.id;
      if (tm.exists(key)) tm.remove(key);
      tm.addCanvas(key, canvas);
      const img = this.scene.add.image(room.x0 * TILE, room.y0 * TILE, key).setOrigin(0, 0).setDepth(DEPTH_DECALS);
      this.items.push({ key, img });
    }
  }

  destroy() {
    for (const { key, img } of this.items) {
      img.destroy();
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
    this.items = [];
  }
}
