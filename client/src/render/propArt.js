import { makeCanvas, px, dots, circle, ring, shade, outline } from './pixel.js';
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

// ------------------------------------------------------------------ decoração de parede (sobre a parede de cima)
export function drawDecor(kind) {
  switch (kind) {
    case 'lousa': return c(96, 32, (ctx) => {
      px(ctx, 2, 5, 92, 20, '#8a5a3a'); px(ctx, 4, 7, 88, 16, '#1f5a3a');
      ctx.fillStyle = '#dfe8df';
      for (const [x, y, w] of [[10, 10, 18], [10, 14, 26], [40, 11, 10], [56, 10, 22], [60, 15, 14], [34, 17, 30]]) ctx.fillRect(x, y, w, 1);
      px(ctx, 80, 22, 6, 2, '#ffffff');
    });
    case 'placar': return c(96, 32, (ctx) => {
      px(ctx, 14, 4, 68, 22, '#1b1424'); px(ctx, 16, 6, 64, 18, '#2b2b33');
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(22, 10, 8, 10); ctx.fillRect(34, 10, 8, 10);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(54, 10, 8, 10); ctx.fillRect(66, 10, 8, 10);
      px(ctx, 47, 12, 2, 2, '#ffffff'); px(ctx, 47, 17, 2, 2, '#ffffff');
    });
    case 'estante_parede': return c(96, 32, (ctx) => {
      px(ctx, 4, 3, 88, 25, '#6a4426');
      for (let y = 5; y < 26; y += 10) {
        for (let x = 6; x < 90; x += 3) px(ctx, x, y, 2, 8, ['#d94a4a', '#3a6fd8', '#f2c94c', '#3ac46a', '#b366ff'][(x + y) % 5]);
        px(ctx, 5, y + 8, 86, 2, '#4a2e18');
      }
    });
    case 'cartaz': return c(32, 32, (ctx) => {
      px(ctx, 7, 5, 18, 22, '#fbfbf3'); px(ctx, 9, 8, 14, 6, '#ff7a1a'); px(ctx, 9, 16, 14, 1, '#9aa0a6'); px(ctx, 9, 19, 10, 1, '#9aa0a6'); px(ctx, 9, 22, 12, 1, '#9aa0a6');
    });
    case 'relogio': return c(32, 32, (ctx) => {
      circle(ctx, 16, 14, 8, '#fbfbf3'); ring(ctx, 16, 14, 8, '#2b2b33'); px(ctx, 16, 8, 1, 6, '#1b1424'); px(ctx, 16, 14, 5, 1, '#e03a3a');
    });
    case 'tabela_periodica': return c(32, 32, (ctx) => {
      px(ctx, 3, 6, 26, 18, '#fbfbf3');
      const cols = ['#ff8fa3', '#9be27a', '#9cc3e6', '#ffd23f'];
      for (let y = 8; y < 22; y += 3) for (let x = 5; x < 27; x += 3) if (!(y < 12 && x > 7 && x < 24)) px(ctx, x, y, 2, 2, cols[(x + y) % 4]);
    });
    case 'cartaz_dna': return c(32, 32, (ctx) => {
      px(ctx, 7, 4, 18, 24, '#e8f8ff');
      for (let y = 6; y < 26; y++) { const o = Math.round(Math.sin(y / 2.5) * 4); px(ctx, 16 + o, y, 1, 1, '#3ac46a'); px(ctx, 16 - o, y, 1, 1, '#ff6b9a'); }
    });
    case 'cesta': return c(32, 32, (ctx) => {
      px(ctx, 6, 3, 20, 12, '#fbfbf3'); px(ctx, 12, 7, 8, 6, '#e03a3a'); px(ctx, 11, 15, 10, 2, '#ff7a1a');
      for (let x = 12; x < 21; x += 2) px(ctx, x, 17, 1, 6, '#f6f6f6');
    });
    case 'quadro': return c(32, 32, (ctx) => {
      px(ctx, 5, 5, 22, 18, '#c9a227'); px(ctx, 7, 7, 18, 14, '#7ac0e8'); px(ctx, 7, 15, 18, 6, '#3a9a4a'); circle(ctx, 21, 10, 2, '#ffd23f');
    });
    case 'janela': return c(32, 32, (ctx) => {
      px(ctx, 5, 4, 22, 22, '#e8e8e8'); px(ctx, 7, 6, 8, 8, '#9cd6ff'); px(ctx, 17, 6, 8, 8, '#9cd6ff'); px(ctx, 7, 16, 8, 8, '#9cd6ff'); px(ctx, 17, 16, 8, 8, '#9cd6ff');
      px(ctx, 8, 7, 3, 1, '#ffffff');
    });
    case 'mural': return c(32, 32, (ctx) => {
      px(ctx, 3, 5, 26, 20, '#c8a26a'); px(ctx, 6, 8, 7, 6, '#fbfbf3'); px(ctx, 16, 7, 9, 5, '#ffd23f'); px(ctx, 14, 15, 8, 7, '#9be27a'); px(ctx, 6, 17, 5, 5, '#ff8fa3');
      dots(ctx, [[9, 8], [20, 7], [18, 15], [8, 17]], '#e03a3a');
    });
    case 'cardapio': return c(32, 32, (ctx) => {
      px(ctx, 4, 4, 24, 22, '#1b1424'); px(ctx, 6, 6, 20, 18, '#2a2540');
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(8, 8, 12, 2);
      ctx.fillStyle = '#ffffff'; for (const y of [12, 15, 18, 21]) ctx.fillRect(8, y, 10, 1);
      ctx.fillStyle = '#5ee05e'; for (const y of [12, 15, 18, 21]) ctx.fillRect(21, y, 3, 1);
    });
    default: return c(32, 32, (ctx) => px(ctx, 8, 8, 16, 16, '#888'));
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
