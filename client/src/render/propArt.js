import { makeCanvas, px, dots, circle, ring, shade, outline, hash } from './pixel.js';
import { DECOR_WIDTH } from '/shared/sim/salas/kinds.js';
import { drawCharacterSheet } from './characterArt.js';
import { strip } from './enemyArt.js';

function c(w, h, draw, doOutline = true) {
  const [cv, ctx] = makeCanvas(w, h);
  draw(ctx);
  if (doOutline) outline(ctx, w, h);
  return cv;
}

// ------------------------------------------------------------------ caixas, barris, espinhos
export function drawCrate() {
  return c(32, 32, (ctx) => {
    const b = '#c8945a', d = '#9a6a3a', l = '#e0b07a';
    px(ctx, 3, 5, 26, 24, b);
    px(ctx, 3, 5, 26, 3, l);
    px(ctx, 3, 26, 26, 3, d);
    px(ctx, 14, 5, 4, 24, '#d9c48a'); // fita adesiva
    px(ctx, 6, 12, 6, 4, '#fbfbf3'); px(ctx, 7, 13, 4, 1, '#3a6fd8'); // etiqueta "LIVROS"
    dots(ctx, [[22, 10], [24, 12], [21, 20]], d);
  });
}

export function drawBarrel() {
  return c(32, 32, (ctx) => {
    const g = '#3a9a4a', d = '#2a6a32', l = '#5ac46a';
    px(ctx, 7, 4, 18, 26, g);
    px(ctx, 6, 7, 20, 20, g);
    px(ctx, 7, 4, 18, 3, l);
    px(ctx, 6, 11, 20, 2, d); px(ctx, 6, 21, 20, 2, d);
    // símbolo de perigo
    px(ctx, 12, 14, 8, 6, '#f2c94c');
    dots(ctx, [[15, 15], [16, 15], [15, 16], [16, 16], [15, 18], [16, 18]], '#1b1424');
    px(ctx, 13, 2, 6, 3, '#9aa0a6');
  });
}

export function drawSpikes(state) {
  // state 0 = abaixados (furinhos), 1 = avisando, 2 = para cima
  return c(32, 32, (ctx) => {
    px(ctx, 2, 2, 28, 28, state === 1 ? '#7a3a3a' : '#5a5a66');
    px(ctx, 3, 3, 26, 26, state === 1 ? '#9a4a4a' : '#6e6e7a');
    for (let y = 7; y < 30; y += 8) {
      for (let x = 7; x < 30; x += 8) {
        if (state === 2) {
          px(ctx, x - 1, y - 5, 3, 6, '#d8dde3');
          px(ctx, x, y - 7, 1, 2, '#ffffff');
          px(ctx, x - 2, y + 1, 5, 2, '#9aa0a6');
        } else {
          px(ctx, x - 1, y - 1, 3, 3, '#2b2b33');
        }
      }
    }
  }, false);
}

// ------------------------------------------------------------------ objetos quebráveis (prop_<kind>; mesmo tamanho e estilo da caixa)
export function drawProp(kind) {
  switch (kind) {
    case 'caixa': return drawCrate();
    case 'barril': return drawBarrel();
    case 'mochila': return c(32, 32, (ctx) => {
      const b = '#2f9ab0', d = '#1f6f82', l = '#5ac8dc';
      px(ctx, 12, 3, 8, 4, '#2b2b33'); px(ctx, 14, 4, 4, 2, '#5a5a66');            // alça
      px(ctx, 5, 7, 22, 22, b); px(ctx, 6, 6, 20, 2, b);                            // corpo
      px(ctx, 5, 7, 22, 8, d); px(ctx, 5, 14, 22, 1, '#14505e'); px(ctx, 5, 7, 22, 1, l); // aba
      px(ctx, 14, 12, 4, 4, '#f2c94c'); px(ctx, 15, 13, 2, 2, '#c9971f');            // fivela
      px(ctx, 8, 17, 16, 10, l); px(ctx, 8, 17, 16, 1, '#8ae0ee'); px(ctx, 8, 26, 16, 1, d); // bolso da frente
      px(ctx, 9, 19, 14, 1, '#14505e'); px(ctx, 21, 18, 3, 3, '#f2c94c');            // zíper e puxador
      px(ctx, 2, 10, 3, 14, '#14505e'); px(ctx, 27, 10, 3, 14, '#14505e');           // alças laterais
      px(ctx, 11, 22, 3, 3, '#ff7a1a'); px(ctx, 12, 21, 1, 1, '#ffb02e');            // chaveirinho
    });
    case 'pilha_livros': return c(32, 32, (ctx) => {
      const book = (x, y, w, h, col) => {
        px(ctx, x, y, w, h, col); px(ctx, x, y, w, 1, shade(col, 0.3)); px(ctx, x, y + h - 1, w, 1, shade(col, -0.3));
        px(ctx, x + w - 3, y + 1, 3, h - 2, '#f4efe0'); px(ctx, x + w - 3, y + 2, 3, 1, '#d8d0b8'); // páginas
        px(ctx, x + 2, y + 2, 1, h - 4, shade(col, 0.4));                                            // lombada
      };
      book(3, 22, 26, 7, '#d94a4a'); book(5, 16, 22, 6, '#3a6fd8'); book(4, 10, 23, 6, '#2fa860'); book(7, 5, 18, 5, '#f2c94c');
      px(ctx, 18, 12, 1, 7, '#ffffff'); px(ctx, 11, 7, 6, 1, '#8a6a10');                              // marcador e título
      px(ctx, 12, 24, 8, 2, '#f4efe0'); px(ctx, 14, 18, 6, 1, '#f4efe0');
    });
    case 'caixa_tubos': return c(32, 32, (ctx) => {
      px(ctx, 4, 15, 24, 14, '#a8b4bc'); px(ctx, 4, 15, 24, 2, '#d0dae0'); px(ctx, 4, 27, 24, 2, '#7a8892'); // estante de plástico
      const cols = ['#e85aa0', '#7a8ae8', '#f2c94c', '#3ac4a8', '#9a5ac8'];
      for (let i = 0; i < 5; i++) {
        const x = 6 + i * 5, top = 4 + (i % 2) * 2;
        px(ctx, x, top, 3, 14, '#d8f0ff'); px(ctx, x, top + 6 - (i % 3), 3, 8 + (i % 3), cols[i]); px(ctx, x, top, 3, 2, '#2b2b33'); px(ctx, x, top + 3, 1, 8, '#ffffff'); // tubos
      }
      px(ctx, 8, 20, 16, 5, '#fbfbf3'); px(ctx, 10, 22, 8, 1, '#9aa0a6'); px(ctx, 20, 21, 2, 3, '#e03a3a');               // etiqueta
      for (let i = 0; i < 5; i++) px(ctx, 6 + i * 5, 16, 3, 1, '#4a5a66');                                               // furos
    });
    case 'cesto_bolas': return c(32, 32, (ctx) => {
      circle(ctx, 11, 11, 6, '#e8761c'); px(ctx, 5, 11, 13, 1, '#7a3a0c'); px(ctx, 11, 5, 1, 13, '#7a3a0c'); px(ctx, 7, 7, 2, 2, '#ffa050');       // basquete
      circle(ctx, 22, 10, 5, '#fbfbf3'); px(ctx, 20, 8, 3, 3, '#2b2b33'); px(ctx, 24, 12, 2, 2, '#2b2b33'); px(ctx, 19, 12, 2, 1, '#2b2b33');       // futebol
      circle(ctx, 16, 14, 4, '#f2c94c'); px(ctx, 12, 14, 9, 1, '#3a6fd8'); px(ctx, 16, 10, 1, 9, '#3a6fd8');                                        // vôlei
      px(ctx, 3, 15, 26, 14, '#5a6a76'); px(ctx, 3, 15, 26, 2, '#9aa7b0'); px(ctx, 3, 27, 26, 2, '#3a4650');                                       // cesto de aramado
      for (let x = 6; x < 29; x += 4) px(ctx, x, 17, 1, 10, '#8a9aa6');
      for (let y = 19; y < 27; y += 4) px(ctx, 3, y, 26, 1, '#8a9aa6');
    });
    case 'vaso': return c(32, 32, (ctx) => {
      px(ctx, 11, 3, 2, 8, '#2f7a3a'); px(ctx, 18, 5, 2, 7, '#2f7a3a');                                     // hastes
      circle(ctx, 12, 4, 3, '#ff8fb1'); circle(ctx, 19, 6, 3, '#ffd23f'); circle(ctx, 15, 8, 2, '#e03a3a');  // flores
      px(ctx, 9, 8, 5, 2, '#4aa04a'); px(ctx, 19, 9, 5, 2, '#4aa04a');
      px(ctx, 9, 11, 14, 3, '#e8e8f4'); px(ctx, 9, 11, 14, 1, '#ffffff');                                     // boca
      px(ctx, 6, 14, 20, 12, '#e8e8f4'); px(ctx, 8, 26, 16, 3, '#c8c8dc'); px(ctx, 6, 14, 3, 12, '#ffffff'); px(ctx, 23, 14, 3, 12, '#b8b8d0');
      px(ctx, 6, 18, 20, 2, '#3a6fd8'); px(ctx, 6, 23, 20, 2, '#3a6fd8');                                    // faixas azuis
      for (let x = 9; x < 24; x += 4) { px(ctx, x, 20, 2, 3, '#3a6fd8'); px(ctx, x + 1, 19, 1, 1, '#5a8af0'); } // desenho
    });
    case 'pilha_papeis': return c(32, 32, (ctx) => {
      px(ctx, 4, 20, 24, 9, '#e8c878'); px(ctx, 4, 20, 24, 2, '#f8e098'); px(ctx, 4, 28, 24, 1, '#b8985a'); // pasta
      px(ctx, 6, 14, 21, 7, '#f4efe0'); px(ctx, 6, 20, 21, 1, '#c8c0a8'); px(ctx, 5, 8, 21, 7, '#fbfbf3'); px(ctx, 5, 14, 21, 1, '#c8c0a8'); // folhas
      px(ctx, 8, 4, 18, 5, '#f4f0f8'); px(ctx, 8, 8, 18, 1, '#c8c0d0');
      for (const y of [5, 7]) px(ctx, 10, y, 12, 1, '#9aa0b0');
      px(ctx, 7, 10, 10, 1, '#9aa0b0'); px(ctx, 7, 12, 8, 1, '#9aa0b0');
      px(ctx, 19, 10, 5, 3, '#e03a3a'); px(ctx, 20, 11, 3, 1, '#ff8a8a');                                    // carimbo
      px(ctx, 24, 5, 3, 6, '#2b2b33'); px(ctx, 25, 6, 1, 3, '#9aa0a6');                                      // clipe
      px(ctx, 11, 23, 8, 3, '#ffe066');                                                                       // post-it
    });
    case 'bandeja': return c(32, 32, (ctx) => {
      px(ctx, 3, 6, 26, 22, '#e87a2a'); px(ctx, 3, 6, 26, 2, '#ffa04a'); px(ctx, 3, 26, 26, 2, '#b8561a'); // bandeja laranja
      px(ctx, 5, 9, 22, 16, '#f6b06a');
      circle(ctx, 13, 17, 7, '#fbfbf3'); circle(ctx, 13, 17, 5, '#e8e8e0');                                    // prato
      px(ctx, 9, 15, 4, 4, '#fbfbf3'); px(ctx, 13, 14, 4, 3, '#7a4a22'); px(ctx, 12, 18, 4, 2, '#7a4a22'); px(ctx, 10, 13, 2, 2, '#e03a3a'); // arroz, feijão, tomate
      px(ctx, 22, 9, 4, 7, '#bfe9ff'); px(ctx, 22, 11, 4, 5, '#ff8a3a'); px(ctx, 22, 9, 4, 1, '#ffffff');    // copo de suco
      circle(ctx, 23, 21, 3, '#e03a3a'); px(ctx, 23, 17, 1, 2, '#3a8a3a');                                    // maçã
      px(ctx, 4, 10, 1, 13, '#c9d1d9'); px(ctx, 6, 10, 1, 8, '#9aa0a6');                                      // talheres
    });
    default: return drawCrate();
  }
}


// ------------------------------------------------------------------ decoração de parede (sobre a parede de cima)
/** Halo de luz pintado (translúcido: alfa baixo para o contorno automático não pegar). */
function halo(ctx, cx, cy, R, rgb, max = 0.3) {
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / R;
      if (d >= 1) continue;
      ctx.fillStyle = `rgba(${rgb},${(max * (1 - d) * (1 - d)).toFixed(3)})`;
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

/** Dígito de 7 segmentos (placar). */
function seg(ctx, x, y, n, color, dim) {
  const S = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }[n];
  const rects = { a: [1, 0, 4, 1], b: [5, 1, 1, 4], c: [5, 6, 1, 4], d: [1, 10, 4, 1], e: [0, 6, 1, 4], f: [0, 1, 1, 4], g: [1, 5, 4, 1] };
  for (const [k, [rx, ry, rw, rh]] of Object.entries(rects)) px(ctx, x + rx, y + ry, rw, rh, S.includes(k) ? color : dim);
}

/** Pontinhos de textura (cortiça etc.), determinísticos. */
function noiseDots(ctx, x0, y0, w, h, color, n, seed) {
  for (let i = 0; i < n; i++) px(ctx, x0 + Math.floor(hash(i, seed, 1) * w), y0 + Math.floor(hash(seed, i, 2) * h), 1, 1, color);
}

/** Sprite decor_<kind>: (largura em tiles × 32) px de largura e 32 de altura. Larguras em DECOR_WIDTH (kinds.js). */
export function drawDecor(kind) {
  const w = (DECOR_WIDTH[kind] || 1) * 32;
  switch (kind) {
    case 'lousa': return c(w, 32, (ctx) => {
      px(ctx, 2, 4, 92, 23, '#8a5a3a'); px(ctx, 2, 4, 92, 1, '#b07a52'); // moldura
      px(ctx, 4, 6, 88, 17, '#1f5a3a'); px(ctx, 4, 6, 88, 1, '#17482e'); // quadro-verde
      px(ctx, 3, 23, 90, 3, '#a8743e'); px(ctx, 3, 23, 90, 1, '#c8945a'); // calha do giz
      ctx.fillStyle = '#dfe8df';
      for (const [x, y, ww] of [[9, 9, 18], [9, 13, 26], [9, 17, 14], [40, 9, 10], [56, 9, 22], [60, 14, 14]]) ctx.fillRect(x, y, ww, 1);
      dots(ctx, [[30, 17], [31, 17], [32, 17], [31, 16], [31, 18], [36, 17], [37, 17], [38, 17], [36, 19], [37, 19], [38, 19]], '#dfe8df'); // "+" e "="
      px(ctx, 74, 15, 1, 5, '#dfe8df'); px(ctx, 74, 19, 8, 1, '#dfe8df'); px(ctx, 74, 15, 8, 1, '#8a9a8a'); px(ctx, 81, 15, 1, 5, '#dfe8df'); // figura
      px(ctx, 12, 24, 5, 2, '#ffffff'); px(ctx, 20, 24, 4, 2, '#ffd23f'); px(ctx, 78, 23, 9, 3, '#3a3a44'); px(ctx, 78, 23, 9, 1, '#6a6a76'); // giz e apagador
    });
    case 'placar': return c(w, 32, (ctx) => {
      px(ctx, 6, 3, 84, 24, '#2b2b33'); px(ctx, 6, 3, 84, 1, '#5a5a66');
      px(ctx, 8, 5, 80, 20, '#14121c');
      px(ctx, 12, 6, 24, 3, '#e03a3a'); px(ctx, 60, 6, 24, 3, '#3a6fd8'); // CASA / VISITANTE
      px(ctx, 44, 6, 8, 3, '#f2c94c');
      seg(ctx, 14, 12, 2, '#ff5a3a', '#2a1c1c'); seg(ctx, 24, 12, 7, '#ff5a3a', '#2a1c1c');
      px(ctx, 47, 14, 2, 2, '#ffe9a0'); px(ctx, 47, 19, 2, 2, '#ffe9a0');
      seg(ctx, 62, 12, 5, '#ffd23f', '#2a281c'); seg(ctx, 72, 12, 1, '#ffd23f', '#2a281c');
      px(ctx, 40, 24, 3, 2, '#e03a3a'); px(ctx, 53, 24, 3, 2, '#e03a3a'); px(ctx, 8, 27, 4, 3, '#5a5a66'); px(ctx, 84, 27, 4, 3, '#5a5a66');
    });
    case 'estante_parede': return c(w, 32, (ctx) => {
      px(ctx, 3, 3, 90, 25, '#6a4426'); px(ctx, 3, 3, 90, 2, '#9a6a3a'); px(ctx, 5, 5, 86, 21, '#2e1a0c');
      const cols = ['#d94a4a', '#3a6fd8', '#f2c94c', '#3ac46a', '#b366ff', '#ff8a3a', '#e8e0c8'];
      for (let r = 0; r < 2; r++) {
        const y = 6 + r * 10;
        let x = 6;
        while (x < 88) {
          const k = hash(x, r, 41), ww = 2 + Math.floor(k * 3), h = 6 + Math.floor(hash(r, x, 3) * 3);
          const col = cols[Math.floor(hash(x, r, 8) * cols.length)];
          px(ctx, x, y + 8 - h, ww, h, col); px(ctx, x, y + 8 - h, 1, h, shade(col, 0.25));
          x += ww + (k > 0.85 ? 2 : 0);
        }
        px(ctx, 5, y + 8, 86, 2, '#4a2e18');
      }
    });
    case 'mapa_mundi': return c(w, 32, (ctx) => {
      px(ctx, 3, 3, 90, 24, '#c9a227'); px(ctx, 3, 3, 90, 1, '#f2d85a'); // moldura dourada
      px(ctx, 5, 5, 86, 20, '#5aa6dc');                                  // oceano
      for (let x = 9; x < 90; x += 12) px(ctx, x, 5, 1, 20, '#7ac0ec');  // meridianos
      for (let y = 10; y < 25; y += 5) px(ctx, 5, y, 86, 1, '#7ac0ec');  // paralelos
      const land = '#4aa04a', hi = '#6ac05a', sand = '#d8c060';
      const blobs = [
        [13, 8, 14, 4, land], [17, 12, 7, 3, land], [21, 15, 6, 8, land], [23, 19, 4, 4, hi], [30, 7, 5, 2, '#f4f4f4'], // Américas e Groenlândia
        [43, 8, 9, 3, hi], [44, 11, 9, 4, sand], [46, 15, 6, 6, land],                                                     // Europa e África
        [54, 7, 24, 5, land], [58, 12, 10, 4, sand], [66, 13, 6, 3, hi], [72, 12, 5, 3, land],                              // Ásia
        [71, 18, 8, 4, sand], [10, 22, 80, 2, '#e8f4f8']                                                                    // Oceania e gelo
      ];
      for (const [x, y, ww, h, col] of blobs) { px(ctx, x, y, ww, h, col); px(ctx, x, y, ww, 1, shade(col, 0.2)); }
    });
    case 'quadro_avisos': return c(w, 32, (ctx) => {
      px(ctx, 3, 3, 58, 24, '#8a5a3a'); px(ctx, 3, 3, 58, 1, '#b07a52');
      px(ctx, 5, 5, 54, 20, '#c8945a'); noiseDots(ctx, 5, 5, 54, 20, '#b07a48', 18, 3);
      px(ctx, 8, 7, 12, 10, '#fbfbf3'); px(ctx, 10, 10, 8, 1, '#9aa0a6'); px(ctx, 10, 12, 6, 1, '#9aa0a6'); px(ctx, 10, 14, 7, 1, '#9aa0a6'); px(ctx, 12, 8, 4, 1, '#e03a3a');
      px(ctx, 24, 8, 9, 9, '#ffd23f'); px(ctx, 26, 10, 5, 1, '#8a6a10'); px(ctx, 26, 12, 4, 1, '#8a6a10');
      px(ctx, 37, 7, 12, 14, '#9cd6ff'); px(ctx, 39, 9, 8, 4, '#3a6fd8'); px(ctx, 39, 15, 8, 1, '#ffffff'); px(ctx, 39, 17, 6, 1, '#ffffff');
      px(ctx, 14, 18, 9, 5, '#ff8fa3'); px(ctx, 16, 20, 5, 1, '#fbfbf3'); px(ctx, 50, 8, 7, 8, '#9be27a');
      dots(ctx, [[13, 7], [28, 8], [42, 7], [18, 18], [53, 8]], '#e03a3a'); // alfinetes
    });
    case 'trofeus': return c(w, 32, (ctx) => {
      px(ctx, 3, 4, 58, 23, '#3a2a5a'); px(ctx, 5, 6, 54, 17, '#2b2040'); // nicho escuro
      px(ctx, 3, 23, 58, 4, '#a8743e'); px(ctx, 3, 23, 58, 1, '#c8945a'); // prateleira
      const cup = (x, y, s) => { // taça dourada
        px(ctx, x - 3 * s, y, 6 * s, 3 * s, '#f2c94c'); px(ctx, x - 2 * s, y + 3 * s, 4 * s, s, '#d8a82a');
        px(ctx, x - 1, y + 4 * s, 2, 2 * s, '#d8a82a'); px(ctx, x - 3 * s, y + 6 * s, 6 * s, 2, '#a87a1a');
        px(ctx, x - 3 * s - 1, y + 1, 1, 2 * s, '#f2c94c'); px(ctx, x + 3 * s, y + 1, 1, 2 * s, '#f2c94c');
        px(ctx, x - 2 * s, y + 1, 1, 2 * s, '#fff2a8');
      };
      cup(13, 10, 1); cup(31, 8, 2); cup(49, 11, 1);
      px(ctx, 22, 14, 1, 6, '#e03a3a'); px(ctx, 21, 19, 3, 3, '#f2c94c'); // medalha
      px(ctx, 40, 18, 7, 4, '#fbfbf3'); px(ctx, 41, 19, 5, 1, '#9aa0a6');  // plaquinha
    });
    case 'cartaz': return c(w, 32, (ctx) => {
      px(ctx, 7, 4, 18, 23, '#fbfbf3'); px(ctx, 7, 4, 18, 1, '#e8e8e0');
      px(ctx, 9, 6, 14, 6, '#ff7a1a'); px(ctx, 12, 8, 8, 2, '#fff2a8');
      circle(ctx, 16, 17, 3, '#ffd23f'); px(ctx, 11, 21, 10, 1, '#9aa0a6'); px(ctx, 11, 23, 8, 1, '#9aa0a6');
      px(ctx, 6, 3, 3, 2, '#e8e0a8'); px(ctx, 23, 3, 3, 2, '#e8e0a8'); // fita nos cantos
    });
    case 'relogio': return c(w, 32, (ctx) => {
      circle(ctx, 16, 15, 10, '#2b2b33'); circle(ctx, 16, 15, 8, '#fbfbf3');
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; px(ctx, Math.round(16 + Math.sin(a) * 6.5), Math.round(15 - Math.cos(a) * 6.5), 1, 1, '#1b1424'); }
      px(ctx, 16, 10, 1, 6, '#1b1424'); px(ctx, 16, 15, 4, 1, '#1b1424'); px(ctx, 14, 17, 1, 1, '#e03a3a'); px(ctx, 15, 16, 1, 1, '#e03a3a'); px(ctx, 16, 15, 1, 1, '#e03a3a');
      px(ctx, 11, 8, 3, 1, '#ffffff');
    });
    case 'tabela_periodica': return c(w, 32, (ctx) => {
      px(ctx, 2, 5, 28, 20, '#2b3a5a'); px(ctx, 3, 6, 26, 18, '#fbfbf3');
      const cols = ['#ff8fa3', '#9be27a', '#9cc3e6', '#ffd23f', '#d8a0f0'];
      for (let y = 8; y < 23; y += 3) for (let x = 4; x < 28; x += 3) if (!(y < 12 && x > 7 && x < 24)) px(ctx, x, y, 2, 2, cols[(x * 3 + y) % 5]);
      px(ctx, 5, 7, 22, 1, '#2b3a5a');
    });
    case 'cartaz_dna': return c(w, 32, (ctx) => {
      px(ctx, 6, 3, 20, 25, '#e8f8ff'); px(ctx, 6, 3, 20, 2, '#3a6fd8');
      for (let y = 7; y < 26; y++) {
        const o = Math.round(Math.sin(y / 2.4) * 5);
        px(ctx, 16 + o, y, 2, 1, '#3ac46a'); px(ctx, 15 - o, y, 2, 1, '#ff6b9a');
        if (y % 3 === 0 && Math.abs(o) < 4) px(ctx, 15 - Math.abs(o), y, Math.abs(o) * 2 + 3, 1, '#9aa0b0');
      }
    });
    case 'cesta': return c(w, 32, (ctx) => {
      px(ctx, 6, 3, 20, 13, '#fbfbf3'); px(ctx, 6, 3, 20, 1, '#e0e0d8'); px(ctx, 12, 8, 8, 6, '#e03a3a'); px(ctx, 13, 9, 6, 4, '#fbfbf3'); // tabela
      px(ctx, 9, 16, 14, 2, '#ff7a1a'); px(ctx, 9, 16, 14, 1, '#ffa04a');                                       // aro
      for (let i = 0; i < 6; i++) px(ctx, 10 + i * 2, 18, 1, 6, '#f6f6f6');
      for (let y = 19; y < 24; y += 2) px(ctx, 11, y, 11, 1, '#d8d8d8');
    });
    case 'quadro': return c(w, 32, (ctx) => {
      px(ctx, 4, 4, 24, 20, '#c9a227'); px(ctx, 4, 4, 24, 1, '#f2d85a'); px(ctx, 6, 6, 20, 16, '#7ac0e8');
      px(ctx, 6, 13, 20, 9, '#3a9a4a'); px(ctx, 9, 11, 9, 5, '#4aa04a'); px(ctx, 16, 14, 10, 4, '#2f7a3a'); circle(ctx, 22, 10, 2, '#ffd23f');
      px(ctx, 8, 8, 5, 1, '#ffffff'); px(ctx, 10, 7, 4, 1, '#ffffff');
    });
    case 'janela': return c(w, 32, (ctx) => {
      px(ctx, 4, 3, 24, 24, '#f4f4f0'); px(ctx, 6, 5, 20, 20, '#7ac8ff'); px(ctx, 6, 5, 20, 7, '#9cd6ff');
      px(ctx, 9, 8, 6, 2, '#ffffff'); px(ctx, 11, 7, 6, 2, '#ffffff'); px(ctx, 18, 13, 6, 2, '#ffffff');
      px(ctx, 6, 19, 20, 6, '#4aa04a'); px(ctx, 10, 17, 3, 3, '#3a8a3a'); px(ctx, 20, 18, 4, 2, '#3a8a3a');
      px(ctx, 15, 5, 2, 20, '#f4f4f0'); px(ctx, 6, 14, 20, 2, '#f4f4f0'); px(ctx, 3, 26, 26, 2, '#cfcfc8'); // caixilho e parapeito
    });
    case 'mural': return c(w, 32, (ctx) => {
      px(ctx, 3, 4, 26, 21, '#8a5a3a'); px(ctx, 5, 6, 22, 17, '#c8a26a');
      px(ctx, 7, 8, 7, 6, '#fbfbf3'); px(ctx, 16, 7, 9, 5, '#ffd23f'); px(ctx, 15, 14, 9, 7, '#9be27a'); px(ctx, 7, 16, 6, 5, '#ff8fa3');
      px(ctx, 9, 10, 3, 1, '#9aa0a6'); px(ctx, 18, 9, 5, 1, '#8a6a10'); circle(ctx, 19, 17, 2, '#3a9a4a');
      dots(ctx, [[10, 8], [21, 7], [19, 14], [9, 16]], '#e03a3a');
    });
    case 'cardapio': return c(w, 32, (ctx) => {
      px(ctx, 3, 4, 26, 22, '#8a5a3a'); px(ctx, 5, 6, 22, 18, '#2a2540'); px(ctx, 5, 6, 22, 1, '#3a3556');
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(9, 8, 14, 2);
      for (const [y, col] of [[12, '#ffffff'], [15, '#ffb0b0'], [18, '#ffffff'], [21, '#b0d8ff']]) { px(ctx, 7, y, 12, 1, col); px(ctx, 21, y, 4, 1, '#5ee05e'); }
    });
    case 'lampada': return c(w, 32, (ctx) => {
      halo(ctx, 16, 15, 15, '255,226,140', 0.34);
      px(ctx, 14, 3, 4, 3, '#5a5a66'); px(ctx, 15, 5, 2, 4, '#3a3a44');            // suporte
      px(ctx, 11, 9, 10, 3, '#7a7a88');                                              // base
      px(ctx, 12, 12, 8, 7, '#fff6c8'); px(ctx, 13, 13, 6, 5, '#ffffff');            // vidro aceso
      px(ctx, 11, 13, 1, 5, '#e8c860'); px(ctx, 20, 13, 1, 5, '#e8c860');
      px(ctx, 13, 19, 6, 2, '#7a7a88');
    });
    case 'bandeira': return c(w, 32, (ctx) => {
      px(ctx, 3, 3, 26, 2, '#4a3a2a'); px(ctx, 2, 2, 2, 4, '#c9a227'); px(ctx, 28, 2, 2, 4, '#c9a227'); // mastro horizontal
      px(ctx, 6, 5, 20, 15, '#2f9a4a'); px(ctx, 6, 5, 20, 1, '#4ac06a');
      for (let i = 0; i < 6; i++) { px(ctx, 16 - (i + 1) * 2, 6 + i, (i + 1) * 4, 1, '#ffd23f'); }       // losango amarelo (metade de cima)
      for (let i = 0; i < 6; i++) { px(ctx, 16 - (6 - i) * 2, 12 + i, (6 - i) * 4, 1, '#ffd23f'); }       // (metade de baixo)
      circle(ctx, 16, 12, 3, '#2a4fa8'); px(ctx, 13, 12, 7, 1, '#fbfbf3');
      px(ctx, 6, 20, 20, 1, '#1f7a38'); px(ctx, 8, 21, 16, 1, '#2f9a4a'); px(ctx, 11, 22, 10, 1, '#2f9a4a'); // barra ondulada
    });
    case 'extintor': return c(w, 32, (ctx) => {
      px(ctx, 11, 9, 10, 18, '#d83a3a'); px(ctx, 12, 7, 8, 3, '#d83a3a'); px(ctx, 12, 9, 2, 17, '#ff6a5a'); px(ctx, 19, 10, 2, 16, '#a82020');
      px(ctx, 13, 3, 6, 4, '#2b2b33'); px(ctx, 11, 4, 4, 2, '#3a3a44'); px(ctx, 19, 5, 4, 2, '#3a3a44'); // válvula e alça
      px(ctx, 22, 6, 2, 12, '#2b2b33'); px(ctx, 21, 17, 3, 3, '#2b2b33');                              // mangueira
      px(ctx, 13, 14, 6, 6, '#fbfbf3'); px(ctx, 15, 15, 2, 4, '#ff7a1a'); px(ctx, 14, 17, 4, 2, '#ffb02e'); // etiqueta com chama
      px(ctx, 10, 11, 12, 1, '#3a3a44'); px(ctx, 10, 23, 12, 1, '#3a3a44');                            // suportes
    });
    default: return c(w, 32, (ctx) => px(ctx, 8, 8, 16, 16, '#888'));
  }
}

// ------------------------------------------------------------------ inimigos novos
export function drawLousaEnemy() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 9, 24, 2, 6, '#5a4a3a'); px(ctx, 21, 24, 2, 6, '#5a4a3a'); // pés do cavalete
    px(ctx, 3, 4, 26, 21, '#8a5a3a'); px(ctx, 5, 6, 22, 17, '#1f5a3a');
    // rosto de giz
    const eye = f ? '#ffd0d0' : '#ffffff';
    px(ctx, 9, 10, 4, 1, eye); px(ctx, 19, 10, 4, 1, eye);
    px(ctx, 10, 12, 2, 2, eye); px(ctx, 20, 12, 2, 2, eye);
    px(ctx, 11, 17, 10, 1, '#ffffff'); dots(ctx, [[10, 16], [21, 16]], '#ffffff');
    // "+" e "×" escritos
    dots(ctx, [[7, 20], [6, 21], [7, 21], [8, 21], [7, 22], [23, 20], [25, 20], [24, 21], [23, 22], [25, 22]], '#dfe8df');
  });
}

export function drawSinal() {
  return strip(32, 32, 2, (ctx, f) => {
    const o = f ? 1 : -1;
    px(ctx, 14, 3, 4, 3, '#7a4a22');
    // sino
    px(ctx, 9 + o, 7, 14, 4, '#f2c94c'); px(ctx, 7 + o, 11, 18, 8, '#f2c94c'); px(ctx, 5 + o, 19, 22, 4, '#f2c94c');
    px(ctx, 9 + o, 8, 3, 9, '#fff2a8');
    px(ctx, 5 + o, 22, 22, 2, '#c9971f');
    circle(ctx, 16 + o * 2, 25, 2, '#c9971f');
    // olhos bravos
    px(ctx, 11 + o, 13, 3, 3, '#1b1424'); px(ctx, 18 + o, 13, 3, 3, '#1b1424');
    dots(ctx, [[10 + o, 11], [11 + o, 12], [21 + o, 11], [20 + o, 12]], '#1b1424');
    // ondas
    if (f) { dots(ctx, [[2, 10], [1, 12], [1, 14], [2, 16], [30, 10], [31, 12], [31, 14], [30, 16]], '#e0b0ff'); }
  });
}

export function drawMochila() {
  return strip(32, 32, 2, (ctx, f) => {
    const b = '#e03a3a', d = '#a82020';
    px(ctx, 7, 7, 18, 20, b); px(ctx, 6, 10, 20, 15, b); px(ctx, 9, 5, 14, 3, d);
    px(ctx, 9, 16, 14, 8, d); px(ctx, 9, 16, 14, 1, '#f2c94c');
    px(ctx, 10, 10, 3, 3, '#ffffff'); px(ctx, 19, 10, 3, 3, '#ffffff'); px(ctx, 11, 11, 2, 2, '#1b1424'); px(ctx, 20, 11, 2, 2, '#1b1424');
    // pavio
    px(ctx, 16, 1, 1, 5, '#5a4a3a'); px(ctx, 15 + f, 0, 2, 2, f ? '#ffd23f' : '#ff7a1a');
    px(ctx, 9, 27 - f, 4, 2, '#2b2b33'); px(ctx, 19, 27 - (1 - f), 4, 2, '#2b2b33');
  });
}

export function drawDiva() {
  return strip(48, 40, 2, (ctx, f) => {
    const b = '#8a4ab0', d = '#6a2a90', l = '#b07ad0';
    px(ctx, 4, 16, 40, 16, b); px(ctx, 2, 12, 8, 20, d); px(ctx, 6, 8, 12, 10, l); // encosto
    px(ctx, 4, 16, 40, 3, l); px(ctx, 4, 32, 4, 5, '#3a2412'); px(ctx, 40, 32, 4, 5, '#3a2412');
    px(ctx, 22, 20, 14, 6, '#d8b0f0'); // almofada
    if (f) dots(ctx, [[30, 6], [29, 7], [31, 7], [30, 8], [36, 3], [35, 4], [37, 4], [36, 5]], '#5ee05e');
  });
}

export function drawCadernoPreto() {
  return strip(44, 44, 2, (ctx, f) => {
    px(ctx, 6, 4, 32, 36, '#1b1b22'); px(ctx, 6, 4, 32, 2, '#3a3a48');
    for (let y = 7; y < 38; y += 4) px(ctx, 3, y, 5, 2, '#9aa0a6');
    px(ctx, 14, 10, 18, 8, '#fbfbf3');
    ctx.fillStyle = '#e03a3a'; ctx.fillRect(16, 13, 14, 2);
    // olhos vermelhos
    const o = f ? 1 : 0;
    px(ctx, 14 + o, 24, 5, 3, '#ff3d3d'); px(ctx, 26 + o, 24, 5, 3, '#ff3d3d');
    dots(ctx, [[14, 22], [15, 23], [30, 22], [29, 23]], '#ff3d3d');
    px(ctx, 16, 32, 12, 2, '#ff3d3d');
  });
}

export function drawAlunos() {
  // alunos com uniforme do colégio (azul) — cabelos variados
  const looks = [
    { skin: '#efc3a0', hair: '#2a1a14', hairStyle: 'short' },
    { skin: '#e2ae8a', hair: '#6b3a22', hairStyle: 'ponytail' },
    { skin: '#c98b6a', hair: '#1c1512', hairStyle: 'curly_short' },
    { skin: '#f0c4a0', hair: '#c49a5e', hairStyle: 'long_straight' }
  ];
  return looks.map((l) => drawCharacterSheet({ ...l, glasses: 'none', beard: 'none', coat: '#3a6fd8', trim: '#f6f6f6', shirt: '#f6f6f6', pants: '#2e3440' }, '#f2c94c'));
}

export function drawCantineira() {
  return drawCharacterSheet({ skin: '#e6b58f', hair: '#4a3020', hairStyle: 'bob', glasses: 'none', beard: 'none', coat: '#f6f6f6', trim: '#e03a3a', shirt: '#e03a3a', pants: '#3a4258' }, '#ffd23f');
}

export function drawStatue() {
  return c(40, 52, (ctx) => {
    const s = '#b8bcc4', d = '#8a8f99', l = '#dde0e6';
    px(ctx, 4, 40, 32, 10, d); px(ctx, 6, 38, 28, 3, s); px(ctx, 6, 40, 28, 1, l);
    // figura de professor com livro
    px(ctx, 14, 22, 12, 16, s); px(ctx, 12, 24, 3, 9, s); px(ctx, 25, 24, 3, 9, s);
    circle(ctx, 20, 14, 7, s); px(ctx, 15, 8, 10, 4, d);
    px(ctx, 17, 13, 2, 2, d); px(ctx, 22, 13, 2, 2, d);
    px(ctx, 22, 26, 8, 6, l); px(ctx, 25, 26, 1, 6, d);
    px(ctx, 14, 22, 3, 16, l);
  });
}

export function drawPlant() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 9, 24, 14, 7, '#b65a3c'); px(ctx, 8, 23, 16, 2, '#d98a6a');
    px(ctx, 15, 14, 2, 10, '#3a8a3a');
    px(ctx, 9, 17, 6, 3, '#5ab85a'); px(ctx, 17, 19, 6, 3, '#5ab85a');
    // boca
    const open = f ? 3 : 1;
    circle(ctx, 16, 10, 6, '#3ac46a');
    px(ctx, 10, 10 - open, 13, open * 2, '#c0262d');
    for (let x = 11; x < 22; x += 3) { px(ctx, x, 10 - open, 1, 1, '#ffffff'); px(ctx, x + 1, 10 + open - 1, 1, 1, '#ffffff'); }
    dots(ctx, [[12, 5], [20, 5]], '#ff6b9a');
  });
}

/** Torreta das armas "deploy" (base + cano), desenhada de frente. */
export function drawTurret() {
  return c(24, 24, (ctx) => {
    px(ctx, 4, 16, 16, 6, '#5a6a85'); px(ctx, 4, 16, 16, 1, '#8a9ab5'); px(ctx, 6, 22, 3, 2, '#2b2b33'); px(ctx, 15, 22, 3, 2, '#2b2b33');
    circle(ctx, 12, 11, 6, '#9aa0a6'); px(ctx, 10, 9, 4, 4, '#3a3f4a'); px(ctx, 11, 10, 2, 2, '#5ef2ff');
  });
}

/** Mina de tachinha (2 quadros: apagada / acesa). */
export function drawMine() {
  return strip(16, 16, 2, (ctx, f) => {
    circle(ctx, 8, 9, 5, '#3a3f4a'); px(ctx, 4, 8, 9, 1, '#5a6a85');
    circle(ctx, 8, 7, 2, f ? '#ff3d3d' : '#7a2a2a'); dots(ctx, [[3, 12], [13, 12], [8, 14]], '#c9d1d9');
  });
}

export function drawCage() {
  return c(48, 56, (ctx) => {
    px(ctx, 2, 2, 44, 4, '#5c6673'); px(ctx, 2, 50, 44, 4, '#5c6673');
    for (let x = 3; x < 46; x += 6) px(ctx, x, 6, 3, 44, '#8f98a3');
    px(ctx, 18, 22, 12, 10, '#f2c94c'); px(ctx, 22, 25, 4, 4, '#3a2412');
  }, false);
}

export function drawExtraBullet(style) {
  switch (style) {
    case 'chalk': return c(10, 10, (ctx) => { px(ctx, 2, 2, 6, 6, '#ffffff'); px(ctx, 3, 3, 4, 4, '#dfe8df'); });
    case 'wave': return c(14, 14, (ctx) => { ring(ctx, 7, 7, 5, '#c86bff', 2); circle(ctx, 7, 7, 2, '#f0d0ff'); });
    case 'paper_red': return c(12, 12, (ctx) => { circle(ctx, 6, 6, 4, '#ff2d2d'); px(ctx, 4, 4, 4, 4, '#ffe0e0'); px(ctx, 5, 5, 2, 1, '#ff2d2d'); });
    default: return c(10, 10, (ctx) => circle(ctx, 5, 5, 3, '#ff4d6d'));
  }
}

export function drawLetters() {
  // anel de letras para a bolha do Grammar Shield
  const [cv, ctx] = makeCanvas(64, 64);
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letters = 'ABCDEFGHIJKL';
  for (let i = 0; i < letters.length; i++) {
    const a = (i / letters.length) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? '#ff8fa3' : '#ffffff';
    ctx.fillText(letters[i], 32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
  }
  ctx.strokeStyle = 'rgba(255,143,163,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.stroke();
  return cv;
}

export { shade };

// ------------------------------------------------------------------ aliados invocados (2 quadros: passo)
const ALLY_SKIN = '#e2ae8a';

/** Legionário romano: elmo vermelho com crista, escudo e lança. */
export function drawLegionario() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 11, 27 + f, 4, 3 - f, '#5a3a22'); px(ctx, 17, 28 - f, 4, 2 + f, '#5a3a22');
    px(ctx, 11, 15, 10, 12, '#b8bcc4'); px(ctx, 11, 22, 10, 4, '#a8242a'); // couraça e saiote
    px(ctx, 13, 17, 6, 1, '#8a8f99'); px(ctx, 13, 19, 6, 1, '#8a8f99');
    circle(ctx, 16, 11, 5, ALLY_SKIN);
    px(ctx, 10, 5, 12, 5, '#b8bcc4'); px(ctx, 13, 2, 6, 3, '#c0262d'); px(ctx, 10, 10, 2, 4, '#8a8f99');
    px(ctx, 14, 11, 1, 2, '#2a1e18'); px(ctx, 18, 11, 1, 2, '#2a1e18');
    px(ctx, 5, 14 + f, 6, 10, '#c0262d'); px(ctx, 5, 14 + f, 6, 1, '#f2c94c'); px(ctx, 7, 18 + f, 2, 2, '#f2c94c'); // escudo
    px(ctx, 25, 6, 1, 22, '#8a5a2a'); px(ctx, 24, 3, 3, 4, '#dde0e6'); // lança
  });
}

/** Cavaleiro medieval: elmo fechado com pluma azul, escudo com cruz e espada. */
export function drawCavaleiro() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 10, 27 + f, 5, 3 - f, '#6a7280'); px(ctx, 17, 28 - f, 5, 2 + f, '#6a7280');
    px(ctx, 9, 14, 14, 13, '#aab2bd'); px(ctx, 9, 14, 14, 2, '#dde0e6'); px(ctx, 9, 25, 14, 2, '#6a7280');
    px(ctx, 11, 8, 10, 8, '#aab2bd'); px(ctx, 11, 8, 10, 1, '#dde0e6');
    px(ctx, 12, 11, 8, 2, '#2b2b33'); px(ctx, 15, 8, 2, 8, '#8a8f99'); // viseira
    px(ctx, 14, 3, 4, 5, '#3a6fd8'); px(ctx, 13, 2, 3, 2, '#5a8ff0'); // pluma
    px(ctx, 3, 14 + f, 7, 10, '#fbfbf3'); px(ctx, 3, 14 + f, 7, 1, '#8a8f99'); px(ctx, 6, 15 + f, 1, 8, '#c0262d'); px(ctx, 4, 18 + f, 5, 1, '#c0262d'); // escudo
    px(ctx, 25, 8, 2, 16, '#dde0e6'); px(ctx, 23, 23, 6, 2, '#f2c94c'); px(ctx, 25, 25, 2, 3, '#8a5a2a'); // espada
  });
}

/** Bandeirante: chapéu de aba larga, colete e mosquete. */
export function drawBandeirante() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 11, 27 + f, 4, 3 - f, '#3a2412'); px(ctx, 17, 28 - f, 4, 2 + f, '#3a2412');
    px(ctx, 11, 15, 10, 12, '#8a5a2a'); px(ctx, 14, 15, 4, 12, '#e8d8a8'); px(ctx, 11, 22, 10, 1, '#3a2412');
    circle(ctx, 16, 11, 5, ALLY_SKIN);
    px(ctx, 14, 12, 1, 2, '#2a1e18'); px(ctx, 18, 12, 1, 2, '#2a1e18'); px(ctx, 13, 14, 6, 2, '#3a2412'); // bigode/barba
    px(ctx, 6, 7, 20, 2, '#5a3a22'); px(ctx, 10, 2, 12, 6, '#6a4a2a'); px(ctx, 10, 6, 12, 1, '#2a1e18'); // chapéu
    px(ctx, 10, 17 + f, 16, 2, '#5a3a22'); px(ctx, 24, 16 + f, 6, 2, '#2b2b33'); px(ctx, 9, 19 + f, 3, 3, ALLY_SKIN); // mosquete
  });
}

/** Capitu: vestido azul-escuro, cabelo preto preso e olhos grandes. */
export function drawCapitu() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 12, 28 + f, 3, 2 - f, '#2a1e18'); px(ctx, 17, 29 - f, 3, 1 + f, '#2a1e18');
    px(ctx, 12, 15, 8, 6, '#2b3a6a'); px(ctx, 9, 21, 14, 8, '#2b3a6a'); px(ctx, 9, 28, 14, 1, '#5a6fb0');
    px(ctx, 14, 15, 4, 2, '#fbfbf3'); // gola
    circle(ctx, 16, 10, 5, ALLY_SKIN);
    px(ctx, 10, 4, 12, 4, '#15101a'); px(ctx, 10, 6, 2, 8, '#15101a'); px(ctx, 20, 6, 2, 8, '#15101a'); px(ctx, 15, 2, 3, 3, '#15101a'); // cabelo
    px(ctx, 12, 9, 3, 3, '#fbfbf3'); px(ctx, 18, 9, 3, 3, '#fbfbf3'); px(ctx, 13, 10, 2, 2, '#15101a'); px(ctx, 19, 10, 2, 2, '#15101a'); // olhos marcantes
    px(ctx, 15, 13, 3, 1, '#c0262d');
    px(ctx, 7, 17 + f, 3, 6, ALLY_SKIN); px(ctx, 22, 17 + f, 3, 6, ALLY_SKIN);
  });
}

/** Macunaíma: herói sem nenhum caráter, magro, de tanga e com cabelo espetado. */
export function drawMacunaima() {
  return strip(32, 32, 2, (ctx, f) => {
    const sk = '#a8683a';
    px(ctx, 11, 24, 3, 5 + f, sk); px(ctx, 18, 24, 3, 6 - f, sk); // pernas
    px(ctx, 12, 14, 8, 10, sk); px(ctx, 11, 21, 10, 3, '#e8c24a'); // tronco e tanga
    px(ctx, 7, 15 - f, 5, 3, sk); px(ctx, 20, 15 + f, 5, 3, sk);
    circle(ctx, 16, 9, 5, sk);
    px(ctx, 11, 1, 2, 4, '#15101a'); px(ctx, 15, 0, 2, 4, '#15101a'); px(ctx, 19, 1, 2, 4, '#15101a'); px(ctx, 11, 4, 10, 2, '#15101a'); // cabelo
    px(ctx, 13, 9, 2, 2, '#fbfbf3'); px(ctx, 18, 9, 2, 2, '#fbfbf3'); px(ctx, 14, 10, 1, 1, '#15101a'); px(ctx, 19, 10, 1, 1, '#15101a');
    px(ctx, 14, 12, 5, 1, '#fbfbf3'); // sorriso
    px(ctx, 12, 14, 8, 1, '#3a8a3a'); // colar
  });
}

/** Policarpo Quaresma: terno escuro, óculos redondos e um livro. */
export function drawPolicarpo() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 11, 27 + f, 4, 3 - f, '#15101a'); px(ctx, 17, 28 - f, 4, 2 + f, '#15101a');
    px(ctx, 10, 14, 12, 14, '#3a3f4a'); px(ctx, 14, 14, 4, 12, '#fbfbf3'); px(ctx, 15, 16, 2, 8, '#c0262d'); // terno, camisa, gravata
    circle(ctx, 16, 9, 5, ALLY_SKIN);
    px(ctx, 11, 3, 10, 3, '#8a8f99'); px(ctx, 10, 5, 2, 4, '#8a8f99'); px(ctx, 20, 5, 2, 4, '#8a8f99'); // cabelo grisalho
    ring(ctx, 13, 9, 2, '#15101a'); ring(ctx, 19, 9, 2, '#15101a'); px(ctx, 15, 9, 2, 1, '#15101a'); // óculos
    px(ctx, 14, 12, 5, 2, '#8a8f99'); // bigode
    px(ctx, 6, 18 + f, 8, 6, '#2a6a32'); px(ctx, 6, 18 + f, 8, 1, '#f2c94c'); px(ctx, 7, 24 + f, 6, 1, '#fbfbf3'); // livro
    px(ctx, 8, 22 + f, 3, 3, ALLY_SKIN);
  });
}
