import { makeCanvas, px, dots, circle, ring, shade, outline } from './pixel.js';

/** Gera uma tira de quadros chamando draw(ctx, frameIndex) para cada um. */
export function strip(w, h, frames, draw, doOutline = true) {
  const [sheet, sctx] = makeCanvas(w * frames, h);
  for (let i = 0; i < frames; i++) {
    const [c, ctx] = makeCanvas(w, h);
    draw(ctx, i);
    if (doOutline) outline(ctx, w, h);
    sctx.drawImage(c, i * w, 0);
  }
  return sheet;
}

// ---------- Caderno Zumbi ----------
export function drawCadernoZumbi() {
  return strip(32, 32, 2, (ctx, f) => {
    const g = '#4f9d4a', gd = '#3a7a36', gl = '#6fbf63';
    const up = f;
    // pés
    px(ctx, 10, 28 - (f ? 1 : 0), 4, 2, gd);
    px(ctx, 18, 28 - (f ? 0 : 1), 4, 2, gd);
    // capa
    px(ctx, 8, 6 + up, 16, 22 - up, g);
    px(ctx, 9, 6 + up, 14, 1, gl);
    px(ctx, 23, 7 + up, 1, 20 - up, '#f3f0e0'); // folhas
    px(ctx, 8, 27, 16, 1, gd);
    // espiral
    for (let y = 8 + up; y < 27; y += 3) px(ctx, 6, y, 3, 1, '#c9d1d9');
    // etiqueta
    px(ctx, 12, 9 + up, 9, 5, '#f6f2e4');
    px(ctx, 13, 11 + up, 7, 1, '#9aa0a6');
    // olhos (um grande, um pequeno — zumbi!)
    px(ctx, 12, 16 + up, 4, 4, '#f6f6e8');
    px(ctx, 13, 17 + up, 2, 2, '#c0262d');
    px(ctx, 19, 17 + up, 2, 2, '#f6f6e8');
    px(ctx, 19, 18 + up, 1, 1, '#1b1424');
    // boca costurada
    px(ctx, 11, 23 + up, 10, 1, '#1b1424');
    dots(ctx, [[12, 22 + up], [14, 24 + up], [16, 22 + up], [18, 24 + up], [20, 22 + up]], '#1b1424');
    // braços esticados
    px(ctx, 24, 14 + up, 5, 2, g);
    px(ctx, 24, 19 + up, 5, 2, g);
    px(ctx, 28, 13 + up, 2, 2, gl);
    px(ctx, 28, 18 + up, 2, 2, gl);
  });
}

// ---------- Prova Voadora ----------
export function drawProvaVoadora() {
  return strip(32, 32, 2, (ctx, f) => {
    const paper = '#fbfbf3';
    // asas
    const wy = f === 0 ? 7 : 14;
    px(ctx, 3, wy, 6, 4, '#e8e8dc'); px(ctx, 4, wy + 4, 4, 1, '#cfcfc0');
    px(ctx, 23, wy, 6, 4, '#e8e8dc'); px(ctx, 24, wy + 4, 4, 1, '#cfcfc0');
    // folha
    px(ctx, 9, 6, 14, 20, paper);
    px(ctx, 19, 6, 4, 4, '#d9d9cc'); // canto dobrado
    px(ctx, 20, 6, 3, 3, 'rgba(0,0,0,0)');
    ctx.clearRect(20, 6, 3, 3);
    dots(ctx, [[19, 9], [20, 9], [21, 9], [22, 9]], '#bdbdb0');
    // linhas
    for (const y of [16, 19, 22]) px(ctx, 11, y, 10, 1, '#9cc3e6');
    // nota vermelha (zero)
    ring(ctx, 13, 9, 2, '#e03a3a');
    // olhos bravos
    dots(ctx, [[11, 11], [12, 12], [19, 11], [18, 12]], '#1b1424');
    px(ctx, 12, 13, 2, 2, '#1b1424');
    px(ctx, 18, 13, 2, 2, '#1b1424');
    // boca
    px(ctx, 14, 17, 4, 1, '#c0262d');
  });
}

// ---------- Estojo Raivoso ----------
export function drawEstojo() {
  // quadros 0-1: aberto (bravo); 2-3: fechado (tampa baixada, invulnerável)
  return strip(32, 32, 4, (ctx, f0) => {
    const closed = f0 >= 2, f = f0 % 2;
    const b = '#3a6fd8', bd = '#2c56ad', bl = '#5a8ff0';
    if (closed) {
      // tampa fechada: corpo metálico azul, sem lápis, zíper trancado e dois olhinhos fechados
      const m = '#7a8aa8', md = '#56637d';
      px(ctx, 4, 12, 24, 14, m); px(ctx, 3, 14, 26, 10, m);
      px(ctx, 5, 12, 22, 1, '#a9b8d4'); px(ctx, 4, 24, 24, 2, md);
      px(ctx, 4, 17, 24, 2, md); // fresta da tampa
      for (let x = 6; x < 26; x += 3) px(ctx, x, 17, 1, 2, '#f2c94c');
      px(ctx, 8, 21, 5, 1, '#1b1424'); px(ctx, 19, 21, 5, 1, '#1b1424');
      px(ctx, 8, 26, 3, 2 - f, md); px(ctx, 21, 26, 3, 1 + f, md);
      return;
    }
    // lápis saindo por cima
    px(ctx, 8, 4 + f, 2, 8, '#ffd23f'); px(ctx, 8, 3 + f, 2, 1, '#ff8fa3');
    px(ctx, 13, 6, 2, 6, '#e03a3a'); px(ctx, 13, 5, 2, 1, '#f6f6f6');
    px(ctx, 21, 5 + f, 2, 7, '#3ac46a'); px(ctx, 21, 4 + f, 2, 1, '#1f6b3a');
    // corpo
    px(ctx, 4, 10, 24, 16, b);
    px(ctx, 3, 12, 26, 12, b);
    px(ctx, 5, 10, 22, 1, bl);
    px(ctx, 4, 24, 24, 2, bd);
    // olhos
    px(ctx, 8, 13, 5, 4, '#ffffff'); px(ctx, 10, 14, 2, 2, '#1b1424');
    px(ctx, 19, 13, 5, 4, '#ffffff'); px(ctx, 20, 14, 2, 2, '#1b1424');
    dots(ctx, [[7, 12], [8, 12], [9, 12], [23, 12], [24, 12], [22, 12]], '#1b1424');
    // zíper-boca
    px(ctx, 5, 19, 22, 3, '#1b1424');
    for (let x = 6; x < 26; x += 2) { px(ctx, x, 19, 1, 1, '#f2c94c'); px(ctx, x + 1, 21, 1, 1, '#f2c94c'); }
    // pezinhos
    px(ctx, 8, 26, 3, 2 - f, bd);
    px(ctx, 21, 26, 3, 1 + f, bd);
  });
}

// ---------- A Máquina de Xerox (64x64) ----------
export function drawXerox() {
  return strip(64, 64, 3, (ctx, f) => {
    const body = '#b8bfc7', side = '#8f98a3', dark = '#5c6673';
    const angry = f === 2;
    // rodinhas
    px(ctx, 10, 55, 6, 4, '#2b2b33'); px(ctx, 48, 55, 6, 4, '#2b2b33');
    // corpo
    px(ctx, 6, 18, 52, 37, body);
    px(ctx, 52, 18, 6, 37, side);
    px(ctx, 6, 53, 52, 2, dark);
    // gavetas
    px(ctx, 10, 46, 38, 1, side); px(ctx, 10, 50, 38, 1, side);
    px(ctx, 26, 47, 6, 2, dark);
    // tampa
    px(ctx, 4, 12, 56, 7, '#6f7a86');
    px(ctx, 5, 12, 54, 1, '#8a96a3');
    // vidro com luz de escaneamento
    const glow = f === 1 ? '#c8ffd8' : angry ? '#ff9a9a' : '#7cf2a0';
    px(ctx, 8, 15, 48, 2, glow);
    // painel / rosto LCD
    px(ctx, 34, 22, 20, 12, '#2b3240');
    const eye = angry ? '#ff4d4d' : '#7cf2a0';
    if (angry) {
      dots(ctx, [[37, 25], [38, 26], [39, 27], [50, 25], [49, 26], [48, 27]], eye);
      px(ctx, 38, 28, 3, 2, eye); px(ctx, 47, 28, 3, 2, eye);
    } else {
      px(ctx, 38, 26, 3, 3, eye); px(ctx, 47, 26, 3, 3, eye);
      dots(ctx, [[37, 24], [38, 24], [39, 24], [47, 24], [48, 24], [49, 24]], eye);
    }
    // botões
    dots(ctx, [[36, 36], [39, 36], [42, 36]], '#ffd23f');
    px(ctx, 46, 35, 6, 3, '#3ac46a');
    // boca (fenda de saída) com língua de papel
    px(ctx, 12, 32, 18, 5, '#1b1424');
    for (let x = 13; x < 29; x += 3) px(ctx, x, 32, 2, 2, '#e8e8dc');
    px(ctx, 16, 37, 9, 8 + (f === 1 ? 1 : 0), '#fbfbf3');
    px(ctx, 17, 39, 7, 1, '#9cc3e6'); px(ctx, 17, 41, 7, 1, '#9cc3e6');
    // bandeja lateral
    px(ctx, 0, 30, 7, 3, '#d0d6dc');
    px(ctx, 1, 26, 6, 4, '#fbfbf3');
  });
}

// ---------- Projéteis ----------
// ---------- Inimigos do andar 1-3 (Etapa 3) ----------
/** Borracha Divisora: bloco rosa com cantos azuis e carinha. */
export function drawBorracha() {
  return strip(32, 32, 2, (ctx, f) => {
    const up = f;
    px(ctx, 9, 28 - f, 5, 2, '#a83a52');
    px(ctx, 18, 28 - (1 - f), 5, 2, '#a83a52');
    px(ctx, 6, 10 + up, 20, 18 - up, '#f08aa0');
    px(ctx, 7, 10 + up, 18, 2, '#ffb7c5');
    px(ctx, 6, 22, 20, 6, '#3d6fd0'); // cinta azul
    px(ctx, 6, 22, 20, 1, '#6f9bf0');
    px(ctx, 12, 14 + up, 3, 4, '#1b1424');
    px(ctx, 18, 14 + up, 3, 4, '#1b1424');
    px(ctx, 12, 14 + up, 1, 1, '#ffffff');
    px(ctx, 18, 14 + up, 1, 1, '#ffffff');
    px(ctx, 14, 19 + up, 5, 1, '#a83a52');
    // farelos
    dots(ctx, [[3, 24], [28, 20 - up], [4, 14 + up]], '#d9738a');
  });
}

/** Grampeador Touro: corpo de grampeador cinza com chifres de grampo. */
export function drawGrampeador() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 8, 28, 4, 2, '#2d3138');
    px(ctx, 20, 28, 4, 2, '#2d3138');
    px(ctx, 5, 14 + f, 22, 10, '#c0392b'); // corpo vermelho
    px(ctx, 5, 14 + f, 22, 2, '#e8695a');
    px(ctx, 4, 22 + f, 24, 6 - f, '#4a505a'); // base
    px(ctx, 4, 22 + f, 24, 1, '#7d8591');
    // chifres
    px(ctx, 3, 9 + f, 3, 6, '#dfe3e8');
    px(ctx, 26, 9 + f, 3, 6, '#dfe3e8');
    px(ctx, 3, 8 + f, 5, 2, '#dfe3e8');
    px(ctx, 24, 8 + f, 5, 2, '#dfe3e8');
    // olhos bravos
    px(ctx, 9, 17 + f, 5, 3, '#f6f6e8');
    px(ctx, 18, 17 + f, 5, 3, '#f6f6e8');
    px(ctx, 11, 18 + f, 2, 2, '#c0262d');
    px(ctx, 19, 18 + f, 2, 2, '#c0262d');
    px(ctx, 9, 16 + f, 5, 1, '#1b1424');
    px(ctx, 18, 16 + f, 5, 1, '#1b1424');
    px(ctx, 14, 22 + f, 4, 1, '#1b1424'); // focinho
  });
}

/** Régua Mira-Laser: régua amarela comprida com lente vermelha. */
export function drawReguaMira() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 12, 28, 3, 2, '#7a5a1c');
    px(ctx, 18, 28, 3, 2, '#7a5a1c');
    px(ctx, 11, 3 + f, 10, 25 - f, '#f1c232');
    px(ctx, 12, 3 + f, 8, 1, '#ffe27a');
    px(ctx, 11, 27, 10, 1, '#b8901a');
    for (let y = 6 + f; y < 26; y += 3) px(ctx, 11, y, y % 2 ? 4 : 2, 1, '#6b4f10'); // marcas
    px(ctx, 14, 8 + f, 5, 5, '#1b1424'); // lente
    px(ctx, 15, 9 + f, 3, 3, f ? '#ff3a3a' : '#c0262d');
    px(ctx, 15, 9 + f, 1, 1, '#ffffff');
    px(ctx, 5, 12 + f, 6, 2, '#6b7280'); // luneta
    px(ctx, 21, 12 + f, 2, 2, '#c0262d');
  });
}

/** Apontador Escavador: lápis curto com ponta em broca. */
export function drawApontador() {
  return strip(32, 32, 2, (ctx, f) => {
    px(ctx, 9, 27, 5, 2, '#5a4a3a');
    px(ctx, 18, 27, 5, 2, '#5a4a3a');
    px(ctx, 7, 12 + f, 18, 15 - f, '#6b7280'); // corpo de apontador metálico
    px(ctx, 8, 12 + f, 16, 2, '#aab2bd');
    px(ctx, 7, 25, 18, 1, '#454b55');
    px(ctx, 12, 17 + f, 8, 5, '#1b1424'); // buraco
    px(ctx, 14, 18 + f, 4, 1, '#f6f6e8');
    // broca no topo
    px(ctx, 13, 4 + f, 6, 8, '#f3c46b');
    px(ctx, 14, 2 + f, 4, 3, '#2d2d2d');
    for (let y = 5 + f; y < 12; y += 2) px(ctx, 13 + ((y + f) % 2), y, 4, 1, '#c88f2a');
    dots(ctx, [[5, 26], [26, 24 - f], [3, 22]], '#7a5a3a'); // terra
  });
}

/** Monitor de Turma: aluno de faixa e prancheta, com apito. */
export function drawMonitor() {
  return strip(32, 32, 2, (ctx, f) => {
    const sk = '#e8b890';
    px(ctx, 11, 27, 4, 3, '#2d3550');
    px(ctx, 17, 27, 4, 3, '#2d3550');
    px(ctx, 9, 13 + f, 14, 14 - f, '#3a5fb0'); // colete azul
    px(ctx, 9, 13 + f, 14, 2, '#6f8fd8');
    px(ctx, 14, 13 + f, 4, 14 - f, '#f6f2e4');
    px(ctx, 10, 6 + f, 12, 8, sk);   // cabeça
    px(ctx, 10, 5 + f, 12, 3, '#3b2a1e');
    px(ctx, 12, 9 + f, 2, 2, '#1b1424');
    px(ctx, 18, 9 + f, 2, 2, '#1b1424');
    px(ctx, 14, 12 + f, 4, 1, '#a0522d');
    // faixa de monitor no braço e prancheta
    px(ctx, 6, 15 + f, 3, 6, '#e0b030');
    px(ctx, 23, 14 + f, 6, 8, '#b8b0a0');
    px(ctx, 24, 15 + f, 4, 6, '#f6f2e4');
    px(ctx, 25, 17 + f, 2, 1, '#9aa0a6');
    px(ctx, 14, 12 + f, 1, 3, '#c9d1d9'); // cordão do apito
  });
}

/** Grêmio Estudantil: aluno com boné, estrela e escudo/cruz de cura. */
export function drawGremio() {
  return strip(32, 32, 2, (ctx, f) => {
    const sk = '#d9a47c';
    px(ctx, 11, 27, 4, 3, '#2d3550');
    px(ctx, 17, 27, 4, 3, '#2d3550');
    px(ctx, 9, 13 + f, 14, 14 - f, '#7a3fb0'); // jaqueta roxa
    px(ctx, 9, 13 + f, 14, 2, '#a870d8');
    px(ctx, 10, 7 + f, 12, 7, sk);
    px(ctx, 9, 4 + f, 14, 4, '#e0b030'); // boné
    px(ctx, 9, 8 + f, 17, 1, '#b8901a');
    px(ctx, 12, 10 + f, 2, 2, '#1b1424');
    px(ctx, 18, 10 + f, 2, 2, '#1b1424');
    px(ctx, 14, 13 + f, 4, 1, '#a0522d');
    // cruz verde no peito
    px(ctx, 14, 17 + f, 4, 8, '#5ee05e');
    px(ctx, 12, 19 + f, 8, 4, '#5ee05e');
    px(ctx, 15, 18 + f, 2, 6, '#ffffff');
    px(ctx, 13, 20 + f, 6, 2, '#ffffff');
  });
}

/** Chamada Fantasma: fantasminha de lençol com lista de chamada. */
export function drawChamada() {
  return strip(32, 32, 2, (ctx, f) => {
    const w = '#e9eef8', wd = '#b9c4dc';
    px(ctx, 8, 6 + f, 16, 18, w);
    px(ctx, 9, 5 + f, 14, 1, w);
    px(ctx, 10, 4 + f, 12, 1, w);
    px(ctx, 8, 6 + f, 2, 18, wd);
    // barra ondulada
    for (let x = 8; x < 24; x += 4) { px(ctx, x, 24 + f, 4, 3 - ((x / 4 + f) % 2), w); }
    px(ctx, 11, 11 + f, 3, 4, '#1b1424');
    px(ctx, 18, 11 + f, 3, 4, '#1b1424');
    px(ctx, 14, 17 + f, 4, 3, '#1b1424');
    // lista de chamada
    px(ctx, 22, 14 + f, 7, 9, '#f6f2e4');
    px(ctx, 22, 14 + f, 7, 1, '#9aa0a6');
    for (let y = 16 + f; y < 22; y += 2) px(ctx, 23, y, 5, 1, '#6b7280');
    px(ctx, 5, 14 + f, 4, 2, wd); // braço
  });
}

function canvasFrom(w, h, draw, doOutline = true) {
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx);
  if (doOutline) outline(ctx, w, h);
  return c;
}

export function drawProjectile(shape, color, accent) {
  switch (shape) {
    case 'paper': return canvasFrom(12, 10, (ctx) => {
      px(ctx, 1, 1, 10, 8, color); px(ctx, 2, 3, 8, 1, '#9cc3e6'); px(ctx, 2, 5, 8, 1, '#9cc3e6'); px(ctx, 3, 1, 1, 8, accent);
    });
    case 'staple': return canvasFrom(10, 7, (ctx) => {
      px(ctx, 1, 1, 8, 1, color); px(ctx, 1, 1, 1, 5, color); px(ctx, 8, 1, 1, 5, color); px(ctx, 2, 2, 6, 1, accent);
    });
    case 'eraser': return canvasFrom(10, 8, (ctx) => {
      px(ctx, 1, 1, 5, 6, color); px(ctx, 6, 1, 3, 6, accent); px(ctx, 1, 1, 8, 1, shade(color, 0.3));
    });
    case 'clip': return canvasFrom(10, 7, (ctx) => {
      ring(ctx, 3, 3, 2, color); ring(ctx, 6, 3, 2, color); px(ctx, 3, 1, 4, 1, accent);
    });
    case 'pencil': return canvasFrom(18, 6, (ctx) => {
      px(ctx, 1, 1, 3, 4, accent); px(ctx, 4, 1, 1, 4, '#c9d1d9'); px(ctx, 5, 1, 9, 4, color);
      px(ctx, 5, 2, 9, 1, shade(color, 0.3)); px(ctx, 14, 1, 2, 4, '#e8c49a'); px(ctx, 16, 2, 1, 2, '#3a3a3a');
    });
    case 'chalk': return canvasFrom(18, 8, (ctx) => {
      px(ctx, 0, 2, 4, 4, accent); px(ctx, 1, 3, 3, 2, '#ffd23f');
      px(ctx, 4, 1, 11, 6, color); px(ctx, 15, 2, 2, 4, color); px(ctx, 5, 5, 10, 1, '#d8d8d8');
    });
    case 'blob': return canvasFrom(12, 12, (ctx) => {
      circle(ctx, 6, 6, 4, color); px(ctx, 4, 4, 2, 2, shade(color, 0.6)); px(ctx, 7, 8, 2, 1, accent);
    });
    case 'bolt': return canvasFrom(16, 10, (ctx) => {
      dots(ctx, [[1, 5], [2, 4], [3, 3], [4, 4], [5, 5], [6, 6], [7, 5], [8, 4], [9, 3], [10, 4], [11, 5], [12, 4], [13, 3], [14, 4]], color);
      dots(ctx, [[2, 5], [5, 4], [8, 5], [11, 4], [13, 4]], accent);
    }, false);
    case 'orb': return canvasFrom(10, 10, (ctx) => {
      circle(ctx, 5, 5, 3, color); px(ctx, 4, 4, 2, 2, '#ffffff');
    });
    case 'paperball': return canvasFrom(10, 10, (ctx) => {
      circle(ctx, 5, 5, 3, color); dots(ctx, [[3, 4], [5, 6], [6, 3], [4, 7]], accent);
    });
    case 'puff': return canvasFrom(14, 14, (ctx) => {
      ctx.globalAlpha = 0.85; circle(ctx, 7, 7, 5, color); circle(ctx, 5, 6, 3, accent); ctx.globalAlpha = 1;
    }, false);
    case 'protractor': return canvasFrom(20, 12, (ctx) => {
      for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) {
        const d = Math.hypot(x - 10, y - 10);
        if (d <= 9.5 && d >= 7.5) px(ctx, x, y, 1, 1, accent);
        else if (d < 7.5) px(ctx, x, y, 1, 1, color);
      }
      px(ctx, 1, 10, 18, 1, accent);
    });
    case 'ball': return canvasFrom(14, 14, (ctx) => {
      circle(ctx, 7, 7, 5, color); px(ctx, 3, 6, 9, 1, accent); px(ctx, 6, 2, 1, 10, accent); px(ctx, 4, 4, 2, 2, '#ffffff');
    });
    case 'proton': return canvasFrom(14, 14, (ctx) => {
      circle(ctx, 7, 7, 5, color); circle(ctx, 7, 7, 2, accent); ring(ctx, 7, 7, 6, shade(color, 0.4));
    });
    case 'dna': return canvasFrom(16, 10, (ctx) => {
      for (let x = 1; x < 15; x++) { const o = Math.round(Math.sin(x * 0.9) * 3); px(ctx, x, 5 + o, 1, 1, color); px(ctx, x, 5 - o, 1, 1, accent); if (x % 3 === 0) px(ctx, x, 5 - Math.abs(o), 1, Math.abs(o) * 2 + 1, '#ffffff'); }
    }, false);
    case 'plane': return canvasFrom(16, 12, (ctx) => {
      dots(ctx, [[14, 6], [13, 5], [13, 6], [12, 4], [12, 5], [12, 6], [12, 7]], color);
      px(ctx, 2, 3, 10, 3, color); px(ctx, 4, 6, 8, 3, shade(color, -0.12)); px(ctx, 2, 6, 10, 1, accent);
    });
    case 'shaving': return canvasFrom(8, 8, (ctx) => {
      px(ctx, 1, 2, 5, 3, color); px(ctx, 2, 3, 3, 1, accent); px(ctx, 5, 4, 2, 2, '#3a3a3a');
    });
    case 'wave': return canvasFrom(14, 14, (ctx) => { ring(ctx, 7, 7, 5, color, 2); px(ctx, 6, 6, 2, 2, accent); }, false);
    case 'beam': return canvasFrom(26, 14, (ctx) => {
      ctx.globalAlpha = 0.8; px(ctx, 0, 3, 26, 8, color); ctx.globalAlpha = 1; px(ctx, 0, 6, 26, 2, '#ffffff'); px(ctx, 20, 2, 6, 10, accent);
    }, false);
    case 'seed': return canvasFrom(10, 10, (ctx) => { circle(ctx, 5, 5, 3, color); px(ctx, 4, 3, 2, 2, accent); });
    // ---- formatos da v0.3
    case 'stone': return canvasFrom(12, 12, (ctx) => { circle(ctx, 6, 6, 4, color); px(ctx, 4, 4, 2, 1, shade(color, 0.4)); px(ctx, 7, 7, 2, 2, accent); });
    case 'paint': return canvasFrom(12, 10, (ctx) => { circle(ctx, 6, 5, 3, color); px(ctx, 2, 4, 2, 2, color); px(ctx, 9, 6, 2, 1, color); px(ctx, 5, 4, 1, 1, accent); });
    case 'page': return canvasFrom(14, 12, (ctx) => {
      px(ctx, 1, 1, 12, 10, color); for (let y = 3; y < 10; y += 2) px(ctx, 3, y, 8, 1, '#9aa0a6'); px(ctx, 1, 1, 12, 1, accent);
    });
    case 'flame': return canvasFrom(12, 12, (ctx) => {
      ctx.globalAlpha = 0.9; circle(ctx, 6, 7, 4, color); circle(ctx, 6, 6, 2, accent); ctx.globalAlpha = 1;
    }, false);
    case 'bubble': return canvasFrom(16, 14, (ctx) => {
      circle(ctx, 8, 6, 5, color); px(ctx, 4, 10, 3, 3, color); px(ctx, 5, 4, 6, 1, accent); px(ctx, 5, 7, 4, 1, accent);
    });
    case 'tack': return canvasFrom(10, 10, (ctx) => { circle(ctx, 5, 5, 3, color); px(ctx, 4, 4, 2, 2, accent); px(ctx, 5, 8, 1, 2, '#c9d1d9'); });
    case 'confetti': return canvasFrom(8, 6, (ctx) => { px(ctx, 1, 1, 3, 2, color); px(ctx, 4, 3, 3, 2, accent); }, false);
    case 'globe': return canvasFrom(18, 18, (ctx) => { circle(ctx, 9, 9, 7, color); px(ctx, 5, 5, 5, 3, accent); px(ctx, 10, 10, 4, 3, accent); px(ctx, 6, 4, 2, 1, '#ffffff'); });
    case 'basketball': return canvasFrom(14, 14, (ctx) => { circle(ctx, 7, 7, 5, color); px(ctx, 2, 7, 11, 1, accent); px(ctx, 7, 2, 1, 11, accent); ring(ctx, 7, 7, 3, accent); });
    case 'soccer': return canvasFrom(14, 14, (ctx) => { circle(ctx, 7, 7, 5, color); circle(ctx, 7, 7, 1, accent); dots(ctx, [[4, 4], [10, 4], [4, 10], [10, 10], [7, 3]], accent); });
    case 'bowling': return canvasFrom(18, 18, (ctx) => { circle(ctx, 9, 9, 7, color); dots(ctx, [[7, 6], [10, 6], [8, 9]], accent); px(ctx, 5, 5, 2, 1, shade(color, 0.5)); });
    default: return canvasFrom(10, 10, (ctx) => circle(ctx, 5, 5, 3, color));
  }
}

export function drawGlyph(ch, color, accent) {
  const [c, ctx] = makeCanvas(16, 16);
  ctx.font = 'bold 14px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(ch, 8, 9);
  // binariza o alfa para manter a cara de pixel art
  const img = ctx.getImageData(0, 0, 16, 16);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 90 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  outline(ctx, 16, 16, accent || '#3a2400');
  return c;
}

export function drawNotaMil() {
  const [c, ctx] = makeCanvas(96, 52);
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e02424';
  ctx.fillText('1000', 48, 27);
  // círculo de correção
  ctx.strokeStyle = '#e02424';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(48, 26, 44, 22, -0.08, 0, Math.PI * 2);
  ctx.stroke();
  const img = ctx.getImageData(0, 0, 96, 52);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > 90 ? 255 : 0;
  ctx.putImageData(img, 0, 0);
  outline(ctx, 96, 52, '#fff4d6');
  return c;
}

export function drawEnemyBullet(style) {
  switch (style) {
    case 'pencil': return canvasFrom(14, 8, (ctx) => {
      px(ctx, 1, 2, 9, 4, '#ff9a3c'); px(ctx, 10, 2, 2, 4, '#ffe0b0'); px(ctx, 12, 3, 1, 2, '#3a1e00'); px(ctx, 1, 3, 9, 1, '#ffd08a');
    }, true);
    case 'toner': return canvasFrom(12, 12, (ctx) => {
      circle(ctx, 6, 6, 4, '#4a2a6a'); px(ctx, 4, 4, 2, 2, '#9a6ad0');
    });
    default: return canvasFrom(12, 12, (ctx) => {
      circle(ctx, 6, 6, 4, '#ff3d6e'); circle(ctx, 6, 6, 2, '#ffd0dc'); px(ctx, 5, 5, 1, 1, '#ffffff');
    });
  }
}
