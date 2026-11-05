import { makeCanvas, px, dots, circle, shade, outline, mix } from './pixel.js';

/**
 * Desenha um personagem chibi 32x32 (cabeça grande, corpo pequeno) a partir do campo "visual"
 * de characters.json. Estilos de cabelo, óculos, barba e cores do jaleco foram escolhidos com base
 * nas fotos dos professores no site do colégio — caricaturas carinhosas, nada exagerado.
 *
 * Quadros gerados (tira horizontal de 6 x 32px):
 *   0-1 parado (respiração), 2-5 andando.
 */
export const CHAR_FRAMES = 6;

export function drawCharacterSheet(v, badgeColor = '#4aa8ff') {
  const [sheet, sctx] = makeCanvas(32 * CHAR_FRAMES, 32);
  const frames = [
    { bob: 0, leg: 0 }, { bob: 1, leg: 0 },
    { bob: 0, leg: 1 }, { bob: 1, leg: 0 }, { bob: 0, leg: 2 }, { bob: 1, leg: 0 }
  ];
  frames.forEach((f, i) => {
    const [c, ctx] = makeCanvas(32, 32);
    drawCharacter(ctx, v, f, badgeColor);
    outline(ctx, 32, 32);
    sctx.drawImage(c, i * 32, 0);
  });
  return sheet;
}

function drawCharacter(ctx, v, { bob, leg }, badgeColor) {
  const b = bob;
  const hair = v.hair;
  const hl = v.hairHighlight || shade(hair, 0.28);
  const hs = shade(hair, -0.3);
  const skin = v.skin;
  const skinS = shade(skin, -0.12);
  const coat = v.coat;
  const coatS = shade(coat, -0.14);
  const trim = v.trim === v.coat ? shade(v.coat, -0.1) : v.trim;
  const shirt = v.shirt;
  const pants = v.pants || '#3a4258';
  const shoe = '#2a2230';

  // 1) cabelo de trás (estilos longos)
  drawBackHair(ctx, v.hairStyle, b, hair, hs, hl);

  // 2) pernas
  const lUp = leg === 1 ? 1 : 0, rUp = leg === 2 ? 1 : 0;
  px(ctx, 11, 27, 4, 3 - lUp, pants);
  px(ctx, 11, 30 - lUp, 4, 1, shoe);
  px(ctx, 17, 27, 4, 3 - rUp, pants);
  px(ctx, 17, 30 - rUp, 4, 1, shoe);

  // 3) corpo (jaleco/blusa)
  px(ctx, 10, 19 + b, 12, 8 - b, coat);
  px(ctx, 21, 20 + b, 1, 7 - b, coatS);
  px(ctx, 10, 26, 12, 1, coatS);
  // gola em V com a camisa por baixo
  px(ctx, 14, 19 + b, 4, 1, shirt);
  px(ctx, 15, 20 + b, 2, 2, shirt);
  dots(ctx, [[13, 19 + b], [18, 19 + b], [14, 20 + b], [17, 20 + b], [14, 21 + b], [17, 21 + b], [15, 22 + b], [16, 22 + b]], trim);
  // broche com a cor da matéria
  px(ctx, 18, 23 + b, 2, 2, badgeColor);
  // braços e mãos
  px(ctx, 8, 20 + b, 2, 5, coat);
  px(ctx, 22, 20 + b, 2, 5, coatS);
  px(ctx, 8, 25 + b, 2, 2, skin);
  px(ctx, 22, 25 + b, 2, 2, skin);
  if (v.necklace) {
    dots(ctx, [[14, 20 + b], [17, 20 + b], [15, 21 + b], [16, 21 + b]], '#e8c84a');
  }

  // 4) cabeça
  px(ctx, 9, 5 + b, 14, 14, skin);
  px(ctx, 8, 6 + b, 16, 12, skin);
  px(ctx, 9, 18 + b, 14, 1, skinS);
  px(ctx, 14, 19 + b, 4, 1, skinS); // pescoço

  // 5) rosto
  const ey = 11 + b;
  if (v.glasses && v.glasses !== 'none') {
    ctx.globalAlpha = 0.35;
    px(ctx, 11, ey - 1, 4, 4, '#cfe8ff');
    px(ctx, 17, ey - 1, 4, 4, '#cfe8ff');
    ctx.globalAlpha = 1;
  }
  // olhos grandes (estilo chibi)
  px(ctx, 12, ey, 2, 3, '#2b1d1d');
  px(ctx, 18, ey, 2, 3, '#2b1d1d');
  dots(ctx, [[12, ey], [18, ey]], '#ffffff');
  // bochechas
  px(ctx, 10, ey + 4, 2, 1, '#f29a9a');
  px(ctx, 20, ey + 4, 2, 1, '#f29a9a');
  // barba
  if (v.beard === 'stubble') {
    // sombra de barba: tom de pele misturado com a cor da barba, no queixo e na mandíbula
    const bc = mix(skin, v.beardColor || hair, 0.38);
    px(ctx, 8, 14 + b, 1, 4, bc); px(ctx, 23, 14 + b, 1, 4, bc);
    px(ctx, 9, 16 + b, 14, 2, bc);
    px(ctx, 10, 18 + b, 12, 1, bc);
    px(ctx, 14, 15 + b, 5, 1, bc);
  } else if (v.beard === 'full') {
    const bc = v.beardColor || hair;
    px(ctx, 14, 15 + b, 5, 1, bc);           // bigode
    px(ctx, 8, 13 + b, 2, 5, bc);            // costeletas
    px(ctx, 22, 13 + b, 2, 5, bc);
    px(ctx, 9, 16 + b, 14, 3, bc);
    px(ctx, 11, 19 + b, 10, 1, bc);
    px(ctx, 10, 17 + b, 12, 1, shade(bc, 0.15));
  }
  // boca (sorriso)
  px(ctx, 15, 16 + b, 3, 1, v.beard === 'full' ? '#f0c8b0' : '#a0453f');
  if (v.beard !== 'full') dots(ctx, [[14, 15 + b], [18, 15 + b]], shade(skin, -0.2));
  // óculos
  if (v.glasses && v.glasses !== 'none') {
    const gc = v.glassesColor || '#2e2e2e';
    if (v.glasses === 'round') {
      dots(ctx, [[12, ey - 2], [13, ey - 2], [11, ey - 1], [14, ey - 1], [11, ey], [14, ey], [11, ey + 1], [14, ey + 1], [11, ey + 2], [14, ey + 2], [12, ey + 3], [13, ey + 3]], gc);
      dots(ctx, [[18, ey - 2], [19, ey - 2], [17, ey - 1], [20, ey - 1], [17, ey], [20, ey], [17, ey + 1], [20, ey + 1], [17, ey + 2], [20, ey + 2], [18, ey + 3], [19, ey + 3]], gc);
    } else {
      // retangular / fino
      px(ctx, 11, ey - 2, 4, 1, gc); px(ctx, 11, ey + 3, 4, 1, gc);
      px(ctx, 10, ey - 2, 1, 6, gc); px(ctx, 15, ey - 2, 1, 6, gc);
      px(ctx, 17, ey - 2, 4, 1, gc); px(ctx, 17, ey + 3, 4, 1, gc);
      px(ctx, 16, ey - 2, 1, 6, gc); px(ctx, 21, ey - 2, 1, 6, gc);
    }
    px(ctx, 15, ey - 1, 2, 1, gc);           // ponte
    px(ctx, 22, ey - 1, 2, 1, gc);           // haste
    px(ctx, 8, ey - 1, 2, 1, gc);
  }

  // 6) cabelo da frente
  drawFrontHair(ctx, v.hairStyle, b, hair, hs, hl);

  // 7) acessórios
  if (v.earrings) dots(ctx, [[8, 15 + b], [23, 15 + b]], '#e8c84a');
}

function drawBackHair(ctx, style, b, h, hs, hl) {
  switch (style) {
    case 'long_straight':
      px(ctx, 6, 7 + b, 20, 18, h);
      px(ctx, 7, 25 + b, 18, 1, hs);
      break;
    case 'long_wavy':
      px(ctx, 6, 7 + b, 20, 18, h);
      for (let y = 9; y < 26; y += 3) {
        px(ctx, 5, y + b, 1, 2, h);
        px(ctx, 26, y + 1 + b, 1, 2, h);
      }
      dots(ctx, [[7, 25 + b], [9, 26 + b], [12, 25 + b], [19, 25 + b], [22, 26 + b], [24, 25 + b]], h);
      break;
    case 'curly_medium':
      for (const [x, y] of [[7, 10], [25, 10], [6, 14], [26, 14], [7, 18], [25, 18], [8, 21], [24, 21]]) circle(ctx, x, y + b, 3, h);
      for (const [x, y] of [[6, 13], [26, 17], [7, 20]]) px(ctx, x, y + b, 1, 1, hl);
      break;
    case 'bob':
      px(ctx, 6, 7 + b, 20, 13, h);
      px(ctx, 5, 10 + b, 22, 9, h);
      px(ctx, 6, 19 + b, 20, 1, hs);
      break;
    case 'ponytail':
      px(ctx, 4, 8 + b, 4, 4, h);
      px(ctx, 3, 12 + b, 4, 6, h);
      px(ctx, 4, 18 + b, 3, 3, h);
      px(ctx, 4, 21 + b, 2, 1, hs);
      px(ctx, 6, 8 + b, 2, 2, '#e04a6a'); // elástico
      break;
    default:
      break;
  }
}

function drawFrontHair(ctx, style, b, h, hs, hl) {
  const cap = () => {
    px(ctx, 10, 3 + b, 12, 1, h);
    px(ctx, 8, 4 + b, 16, 1, h);
    px(ctx, 7, 5 + b, 18, 3, h);
    px(ctx, 11, 4 + b, 6, 1, hl);
  };
  switch (style) {
    case 'short':
      cap();
      px(ctx, 7, 8 + b, 18, 1, h);
      px(ctx, 7, 9 + b, 3, 1, h); px(ctx, 21, 9 + b, 4, 1, h);
      px(ctx, 7, 10 + b, 2, 3, h); px(ctx, 23, 10 + b, 2, 3, h);
      px(ctx, 12, 8 + b, 8, 1, hs);
      break;
    case 'spiky':
      cap();
      dots(ctx, [[9, 3 + b], [11, 2 + b], [12, 1 + b], [14, 2 + b], [16, 1 + b], [17, 2 + b], [19, 1 + b], [21, 2 + b], [22, 3 + b]], h);
      px(ctx, 7, 8 + b, 18, 1, h);
      px(ctx, 7, 9 + b, 2, 3, h); px(ctx, 23, 9 + b, 2, 3, h);
      dots(ctx, [[12, 2 + b], [16, 2 + b], [19, 2 + b]], hl);
      break;
    case 'quiff':
      cap();
      px(ctx, 13, 1 + b, 9, 2, h);
      px(ctx, 15, 0 + b, 6, 1, h);
      px(ctx, 16, 1 + b, 4, 1, hl);
      px(ctx, 7, 8 + b, 18, 1, h);
      px(ctx, 7, 9 + b, 2, 4, h); px(ctx, 23, 9 + b, 2, 4, h);
      break;
    case 'curly_short':
      for (const [x, y] of [[9, 6], [12, 4], [16, 3], [20, 4], [23, 6], [8, 9], [24, 9]]) circle(ctx, x, y + b, 3, h);
      px(ctx, 7, 7 + b, 18, 2, h);
      px(ctx, 6, 10 + b, 2, 3, h); px(ctx, 24, 10 + b, 2, 3, h);
      dots(ctx, [[11, 3 + b], [15, 2 + b], [19, 3 + b], [22, 5 + b], [9, 5 + b]], hl);
      dots(ctx, [[10, 8 + b], [14, 8 + b], [18, 8 + b], [21, 8 + b]], hs);
      break;
    case 'curly_medium':
      for (const [x, y] of [[9, 5], [13, 3], [17, 3], [21, 4], [24, 7], [7, 8]]) circle(ctx, x, y + b, 3, h);
      px(ctx, 7, 7 + b, 18, 2, h);
      px(ctx, 6, 9 + b, 3, 5, h); px(ctx, 23, 9 + b, 3, 5, h);
      dots(ctx, [[12, 2 + b], [16, 2 + b], [20, 3 + b], [8, 4 + b]], hl);
      break;
    case 'bob':
      cap();
      px(ctx, 7, 8 + b, 11, 1, h);
      px(ctx, 7, 9 + b, 6, 1, h);
      px(ctx, 6, 8 + b, 3, 10, h);
      px(ctx, 23, 8 + b, 3, 10, h);
      px(ctx, 20, 8 + b, 5, 1, h);
      px(ctx, 6, 17 + b, 3, 1, hs); px(ctx, 23, 17 + b, 3, 1, hs);
      break;
    case 'long_straight':
      cap();
      // risca no meio
      px(ctx, 7, 8 + b, 7, 1, h); px(ctx, 18, 8 + b, 7, 1, h);
      px(ctx, 7, 9 + b, 4, 1, h); px(ctx, 21, 9 + b, 4, 1, h);
      px(ctx, 6, 8 + b, 3, 16, h);
      px(ctx, 23, 8 + b, 3, 16, h);
      px(ctx, 6, 23 + b, 3, 1, hs); px(ctx, 23, 23 + b, 3, 1, hs);
      px(ctx, 15, 5 + b, 1, 3, hs);
      break;
    case 'long_wavy':
      cap();
      px(ctx, 7, 8 + b, 8, 1, h); px(ctx, 19, 8 + b, 6, 1, h);
      px(ctx, 7, 9 + b, 5, 1, h); px(ctx, 21, 9 + b, 4, 1, h);
      px(ctx, 6, 8 + b, 3, 15, h);
      px(ctx, 23, 8 + b, 3, 15, h);
      for (let y = 9; y < 23; y += 3) {
        px(ctx, 7, y + b, 1, 2, hl);
        px(ctx, 24, y + 1 + b, 1, 2, hl);
      }
      px(ctx, 12, 4 + b, 1, 4, hl);
      px(ctx, 19, 5 + b, 1, 3, hl);
      break;
    case 'ponytail':
      cap();
      px(ctx, 7, 8 + b, 18, 1, h);
      px(ctx, 7, 9 + b, 2, 4, h); px(ctx, 23, 9 + b, 2, 3, h);
      px(ctx, 9, 5 + b, 13, 1, hl);
      px(ctx, 9, 9 + b, 4, 1, h);
      break;
    default:
      cap();
      px(ctx, 7, 8 + b, 18, 1, h);
  }
}

/** Retrato maior (cabeça) para cards: escala o quadro 0. */
export function drawPortrait(sheet, scale = 3) {
  const [c, ctx] = makeCanvas(32 * scale, 26 * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, 0, 0, 32, 26, 0, 0, 32 * scale, 26 * scale);
  return c;
}
