import { makeCanvas, px, dots, circle, ring, shade, outline } from './pixel.js';

function c(w, h, draw, doOutline = true) {
  const [cv, ctx] = makeCanvas(w, h);
  draw(ctx);
  if (doOutline) outline(ctx, w, h);
  return cv;
}

/**
 * Arma segurada (aponta para a direita; o "cabo" fica à esquerda).
 * O formato vem de weapons.json -> sprite.shape; as cores de sprite.color / sprite.accent.
 */
export function drawWeapon(shape, color, accent) {
  const dark = shade(color, -0.35), light = shade(color, 0.3);
  switch (shape) {
    case 'sheets': return c(16, 14, (ctx) => {
      px(ctx, 2, 4, 10, 8, shade(color, -0.1)); px(ctx, 4, 2, 10, 8, color);
      px(ctx, 5, 4, 8, 1, '#9cc3e6'); px(ctx, 5, 6, 8, 1, '#9cc3e6'); px(ctx, 6, 2, 1, 8, accent);
    });
    case 'calculator': return c(14, 16, (ctx) => {
      px(ctx, 1, 1, 12, 14, color); px(ctx, 3, 3, 8, 3, accent);
      for (let y = 8; y < 14; y += 2) for (let x = 3; x < 11; x += 3) px(ctx, x, y, 2, 1, '#d8d8d8');
    });
    case 'pistol': return c(18, 12, (ctx) => {
      px(ctx, 2, 2, 14, 4, color); px(ctx, 2, 2, 14, 1, light); px(ctx, 3, 6, 4, 5, accent); px(ctx, 14, 3, 3, 2, '#c9d1d9');
    });
    case 'smg': return c(22, 12, (ctx) => {
      px(ctx, 2, 2, 16, 5, color); px(ctx, 18, 3, 3, 2, '#9aa0a6'); px(ctx, 3, 7, 3, 4, dark); px(ctx, 10, 7, 3, 4, accent); px(ctx, 2, 2, 16, 1, light);
    });
    case 'shotgun': return c(26, 10, (ctx) => {
      px(ctx, 1, 3, 9, 5, color); px(ctx, 10, 2, 14, 3, accent); px(ctx, 10, 5, 12, 2, shade(accent, -0.2)); px(ctx, 6, 7, 3, 2, dark);
    });
    case 'rifle': return c(28, 10, (ctx) => {
      px(ctx, 1, 3, 10, 4, color); px(ctx, 11, 3, 15, 2, '#3a3a3a'); px(ctx, 9, 1, 8, 2, '#2b2b2b'); px(ctx, 24, 2, 3, 4, accent); px(ctx, 6, 7, 3, 2, dark);
    });
    case 'launcher': return c(28, 14, (ctx) => {
      px(ctx, 2, 3, 22, 7, color); px(ctx, 2, 3, 22, 1, light); px(ctx, 24, 4, 3, 5, accent); px(ctx, 8, 10, 4, 3, dark); px(ctx, 14, 1, 4, 2, dark);
    });
    case 'sword': return c(30, 10, (ctx) => {
      px(ctx, 1, 3, 6, 4, '#7a4a22'); px(ctx, 7, 1, 2, 8, accent);
      ctx.globalAlpha = 0.9; px(ctx, 9, 2, 19, 6, color); ctx.globalAlpha = 1;
      for (let x = 10; x < 28; x += 2) px(ctx, x, 2, 1, x % 4 === 0 ? 3 : 2, '#3a3a3a');
      px(ctx, 28, 3, 1, 4, color);
    });
    case 'bat': return c(28, 10, (ctx) => {
      px(ctx, 1, 4, 7, 2, accent); px(ctx, 8, 3, 8, 4, color); px(ctx, 16, 2, 10, 6, color); px(ctx, 17, 2, 8, 1, light); px(ctx, 1, 3, 2, 4, '#2b2b2b');
    });
    case 'staff': return c(28, 12, (ctx) => {
      px(ctx, 1, 5, 20, 2, color); px(ctx, 1, 5, 20, 1, light); circle(ctx, 23, 6, 3, accent); px(ctx, 22, 5, 1, 1, '#ffffff');
    });
    case 'tube': return c(18, 10, (ctx) => {
      ctx.globalAlpha = 0.9; px(ctx, 2, 2, 13, 6, color); ctx.globalAlpha = 1; px(ctx, 7, 3, 8, 4, accent); px(ctx, 1, 1, 2, 8, '#c9d1d9'); px(ctx, 15, 3, 2, 4, color);
    });
    case 'slingshot': return c(16, 16, (ctx) => {
      px(ctx, 2, 7, 6, 2, color); px(ctx, 8, 3, 2, 10, color); px(ctx, 10, 2, 4, 2, color); px(ctx, 10, 12, 4, 2, color); px(ctx, 13, 4, 1, 8, accent);
    });
    case 'magnifier': return c(20, 14, (ctx) => {
      px(ctx, 1, 6, 8, 2, color); ring(ctx, 13, 7, 5, shade(color, -0.2), 2); circle(ctx, 13, 7, 3, accent); px(ctx, 12, 5, 1, 2, '#ffffff');
    });
    case 'extinguisher': return c(20, 14, (ctx) => {
      px(ctx, 2, 3, 11, 9, color); px(ctx, 2, 3, 11, 1, light); px(ctx, 13, 4, 5, 2, accent); px(ctx, 17, 5, 2, 3, accent); px(ctx, 5, 1, 4, 2, '#2b2b2b'); px(ctx, 4, 6, 6, 3, '#f6f6f6');
    });
    case 'protractor': return c(18, 12, (ctx) => {
      for (let y = 0; y < 10; y++) for (let x = 0; x < 18; x++) {
        const d = Math.hypot(x - 9, y - 10);
        if (d <= 8.5 && d >= 6.5) px(ctx, x, y + 1, 1, 1, accent);
        else if (d < 6.5) px(ctx, x, y + 1, 1, 1, color);
      }
      px(ctx, 1, 10, 16, 1, accent);
    });
    case 'ball': return c(14, 14, (ctx) => {
      circle(ctx, 7, 7, 5, color); px(ctx, 3, 6, 9, 1, accent); px(ctx, 6, 2, 1, 10, accent); px(ctx, 4, 4, 2, 2, '#ffffff');
    });
    case 'cannon': return c(24, 14, (ctx) => {
      px(ctx, 2, 4, 16, 7, color); px(ctx, 2, 4, 16, 1, light); circle(ctx, 19, 7, 4, accent); px(ctx, 18, 6, 2, 2, '#ffffff'); px(ctx, 5, 11, 4, 3, dark);
    });
    case 'dna_gun': return c(22, 12, (ctx) => {
      px(ctx, 2, 3, 14, 6, color); px(ctx, 4, 9, 3, 3, dark);
      for (let x = 15; x < 22; x++) { const o = Math.round(Math.sin(x) * 2); px(ctx, x, 5 + o, 1, 1, accent); px(ctx, x, 6 - o, 1, 1, '#ffffff'); }
    });
    case 'bow': return c(16, 22, (ctx) => {
      for (let y = 1; y < 21; y++) { const x = Math.round(3 + Math.sin((y / 20) * Math.PI) * 8); px(ctx, x, y, 2, 1, color); }
      px(ctx, 3, 1, 1, 20, accent); px(ctx, 5, 10, 10, 1, '#9aa0a6');
    });
    case 'compass': return c(30, 10, (ctx) => {
      px(ctx, 1, 3, 4, 4, accent); px(ctx, 5, 4, 22, 1, color); px(ctx, 5, 6, 18, 1, color); px(ctx, 27, 4, 2, 1, '#ffffff'); px(ctx, 23, 6, 3, 1, '#ffd23f');
    });
    case 'umbrella': return c(26, 22, (ctx) => {
      for (let y = 0; y < 9; y++) px(ctx, 13 - y - 3, 2 + y, (y + 3) * 2, 1, y % 3 === 2 ? shade(color, -0.2) : color);
      px(ctx, 12, 11, 2, 9, accent); px(ctx, 9, 19, 4, 2, accent);
    });
    case 'backpack': return c(18, 20, (ctx) => {
      px(ctx, 2, 3, 14, 15, color); px(ctx, 4, 1, 10, 3, dark); px(ctx, 4, 10, 10, 6, dark); px(ctx, 4, 10, 10, 1, accent); px(ctx, 8, 6, 2, 2, accent);
    });
    case 'sharpener': return c(14, 12, (ctx) => {
      px(ctx, 2, 2, 10, 8, color); px(ctx, 9, 4, 3, 4, '#2b2b33'); px(ctx, 3, 3, 5, 1, '#ffffff'); px(ctx, 12, 5, 1, 2, accent);
    });
    case 'bell': return c(16, 16, (ctx) => {
      px(ctx, 5, 2, 6, 3, color); px(ctx, 4, 5, 8, 6, color); px(ctx, 2, 11, 12, 2, color); circle(ctx, 8, 14, 1, accent); px(ctx, 5, 4, 2, 6, '#fff2a8');
    });
    case 'projector': return c(22, 14, (ctx) => {
      px(ctx, 2, 3, 14, 9, color); circle(ctx, 17, 7, 3, accent); px(ctx, 4, 5, 6, 1, light); px(ctx, 5, 12, 2, 2, dark); px(ctx, 12, 12, 2, 2, dark);
    });
    case 'magnet': return c(18, 16, (ctx) => {
      px(ctx, 2, 2, 12, 4, color); px(ctx, 2, 10, 12, 4, color); px(ctx, 2, 2, 4, 12, color);
      px(ctx, 12, 2, 4, 4, accent); px(ctx, 12, 10, 4, 4, accent);
    });
    // ---- formatos da v0.3
    case 'laser_pen': return c(22, 8, (ctx) => {
      px(ctx, 1, 2, 17, 4, color); px(ctx, 1, 2, 17, 1, light); px(ctx, 18, 3, 3, 2, '#c9d1d9'); px(ctx, 21, 3, 1, 2, accent); px(ctx, 6, 3, 2, 2, accent);
    });
    case 'bunsen': return c(18, 16, (ctx) => {
      px(ctx, 2, 12, 10, 3, color); px(ctx, 6, 4, 3, 8, color); px(ctx, 9, 8, 6, 2, '#9aa0a6'); px(ctx, 5, 1, 5, 3, accent); px(ctx, 6, 0, 3, 2, '#ffd23f');
    });
    case 'grenade': return c(14, 14, (ctx) => {
      circle(ctx, 7, 8, 5, color); px(ctx, 5, 2, 4, 2, '#6a6f78'); px(ctx, 9, 1, 3, 1, accent); px(ctx, 4, 6, 2, 2, '#ffffff');
    });
    case 'stapler': return c(22, 10, (ctx) => {
      px(ctx, 1, 6, 20, 3, dark); px(ctx, 2, 2, 18, 4, color); px(ctx, 2, 2, 18, 1, light); px(ctx, 18, 5, 3, 2, accent);
    });
    case 'drill': return c(24, 14, (ctx) => {
      px(ctx, 2, 3, 12, 6, color); px(ctx, 2, 3, 12, 1, light); px(ctx, 5, 9, 4, 5, dark);
      for (let x = 14; x < 23; x++) px(ctx, x, 5 + (x % 2), 1, 2, accent);
    });
    case 'tack_box': return c(16, 12, (ctx) => {
      px(ctx, 1, 3, 14, 8, color); px(ctx, 1, 3, 14, 1, light); dots(ctx, [[4, 2], [8, 1], [12, 2]], accent); px(ctx, 3, 6, 10, 2, accent);
    });
    case 'fan': return c(18, 18, (ctx) => {
      circle(ctx, 9, 9, 2, accent); px(ctx, 8, 1, 2, 6, color); px(ctx, 8, 11, 2, 6, color); px(ctx, 1, 8, 6, 2, color); px(ctx, 11, 8, 6, 2, color);
    });
    case 'blackhole': return c(16, 16, (ctx) => {
      ring(ctx, 8, 8, 6, accent, 2); circle(ctx, 8, 8, 4, color); px(ctx, 6, 6, 1, 1, '#ffffff');
    });
    case 'scissors': return c(20, 12, (ctx) => {
      ring(ctx, 3, 3, 2, color); ring(ctx, 3, 9, 2, color); px(ctx, 5, 4, 14, 1, accent); px(ctx, 5, 7, 14, 1, accent); px(ctx, 7, 5, 2, 2, '#3a3a3a');
    });
    case 'clipboard': return c(16, 20, (ctx) => {
      px(ctx, 1, 2, 14, 17, color); px(ctx, 3, 4, 10, 13, accent); px(ctx, 5, 0, 6, 3, '#9aa0a6');
      for (let y = 7; y < 16; y += 3) px(ctx, 4, y, 8, 1, '#9cc3e6');
    });
    case 'flagpole': return c(30, 14, (ctx) => {
      px(ctx, 1, 9, 27, 2, color); px(ctx, 1, 9, 27, 1, light); px(ctx, 20, 1, 9, 8, accent); px(ctx, 22, 3, 4, 3, '#ffd23f');
    });
    case 'exam_stack': return c(16, 14, (ctx) => {
      px(ctx, 1, 6, 13, 7, shade(color, -0.15)); px(ctx, 2, 4, 13, 7, shade(color, -0.05)); px(ctx, 3, 2, 12, 7, color); px(ctx, 11, 3, 3, 2, accent);
    });
    case 'atom': return c(18, 18, (ctx) => {
      ring(ctx, 9, 9, 7, color); px(ctx, 2, 8, 14, 2, accent); px(ctx, 8, 2, 2, 14, accent); circle(ctx, 9, 9, 2, '#ffffff');
    });
    case 'confetti': return c(22, 14, (ctx) => {
      px(ctx, 2, 4, 14, 7, color); px(ctx, 16, 2, 4, 11, light); dots(ctx, [[19, 1], [21, 4], [20, 12], [18, 0]], accent); px(ctx, 5, 11, 3, 3, dark);
    });
    case 'tuning_fork': return c(24, 10, (ctx) => {
      px(ctx, 1, 4, 10, 2, color); px(ctx, 11, 2, 2, 6, color); px(ctx, 13, 2, 10, 2, color); px(ctx, 13, 6, 10, 2, color); px(ctx, 22, 0, 1, 10, accent);
    });
    case 'xray': return c(26, 14, (ctx) => {
      px(ctx, 2, 3, 18, 8, color); px(ctx, 2, 3, 18, 1, light); px(ctx, 20, 4, 4, 6, accent); px(ctx, 6, 5, 8, 4, accent); px(ctx, 7, 11, 4, 3, dark);
    });
    case 'balloon': return c(16, 18, (ctx) => {
      circle(ctx, 8, 7, 6, color); px(ctx, 4, 12, 3, 4, color); px(ctx, 3, 15, 2, 2, color); px(ctx, 5, 5, 6, 1, accent); px(ctx, 5, 8, 4, 1, accent);
    });
    case 'catapult': return c(22, 16, (ctx) => {
      px(ctx, 1, 12, 18, 3, color); px(ctx, 4, 6, 2, 6, color); px(ctx, 5, 6, 14, 2, color); ring(ctx, 18, 5, 2, accent); circle(ctx, 3, 15, 1, '#3a3a3a'); circle(ctx, 16, 15, 1, '#3a3a3a');
    });
    case 'brush': return c(24, 8, (ctx) => {
      px(ctx, 1, 3, 13, 2, color); px(ctx, 14, 2, 3, 4, '#c9d1d9'); px(ctx, 17, 1, 6, 6, accent); px(ctx, 22, 2, 1, 4, shade(accent, -0.3));
    });
    case 'spear': return c(32, 10, (ctx) => {
      px(ctx, 1, 4, 22, 2, accent); px(ctx, 6, 3, 3, 4, color); dots(ctx, [[23, 3], [23, 6], [24, 2], [24, 7]], color); px(ctx, 23, 4, 7, 2, color); px(ctx, 30, 4, 1, 2, light);
    });
    case 'flask': return c(14, 16, (ctx) => {
      px(ctx, 5, 1, 4, 5, '#c9d1d9'); px(ctx, 3, 6, 8, 2, accent); px(ctx, 2, 8, 10, 7, accent); px(ctx, 3, 9, 8, 5, color); px(ctx, 4, 10, 2, 2, '#ffffff');
    });
    case 'book': return c(18, 14, (ctx) => {
      px(ctx, 1, 2, 16, 11, color); px(ctx, 2, 3, 14, 9, '#fbfbf3'); px(ctx, 8, 2, 2, 11, dark); px(ctx, 3, 5, 4, 1, accent); px(ctx, 11, 5, 4, 1, accent);
    });
    case 'coil': return c(22, 12, (ctx) => {
      px(ctx, 1, 4, 8, 5, color); for (let x = 9; x < 19; x += 2) px(ctx, x, 3, 1, 7, accent); circle(ctx, 20, 6, 2, '#ffffff');
    });
    case 'globe': return c(16, 18, (ctx) => {
      circle(ctx, 8, 7, 6, color); px(ctx, 4, 4, 4, 3, accent); px(ctx, 9, 8, 4, 3, accent); px(ctx, 7, 14, 2, 2, '#c9a227'); px(ctx, 4, 16, 8, 2, '#c9a227');
    });
    default: return c(18, 10, (ctx) => { px(ctx, 2, 2, 14, 6, color); px(ctx, 2, 2, 14, 1, accent); });
  }
}

// ---------- Itens / interativos ----------
export function drawChest(open) {
  return c(30, 26, (ctx) => {
    const wood = '#a0612e', woodD = '#7a4520', gold = '#f2c94c';
    if (open) {
      px(ctx, 3, 2, 24, 7, woodD); px(ctx, 4, 3, 22, 4, '#3a2412');
      px(ctx, 3, 9, 24, 15, wood);
      px(ctx, 6, 7, 18, 3, '#fff2a8');
    } else {
      px(ctx, 3, 4, 24, 8, wood); px(ctx, 4, 3, 22, 1, shade(wood, 0.2));
      px(ctx, 3, 12, 24, 12, wood);
    }
    px(ctx, 3, 11, 24, 2, gold);
    px(ctx, 3, 4, 2, 20, gold); px(ctx, 25, 4, 2, 20, gold);
    px(ctx, 13, 10, 4, 5, gold); px(ctx, 14, 12, 2, 2, '#3a2412');
    px(ctx, 3, 23, 24, 1, woodD);
  });
}

export function drawHealStation(used) {
  return c(30, 30, (ctx) => {
    const body = used ? '#9aa0a6' : '#f6f6f6';
    px(ctx, 3, 6, 24, 20, body); px(ctx, 3, 6, 24, 2, shade(body, -0.1));
    px(ctx, 11, 2, 8, 4, '#6f7a86');
    const red = used ? '#6f7a86' : '#e03a3a';
    px(ctx, 12, 10, 6, 14, red); px(ctx, 8, 14, 14, 6, red);
    px(ctx, 3, 25, 24, 1, '#5c6673');
  });
}

export function drawPortalFrames() {
  const frames = 8;
  const [sheet, sctx] = makeCanvas(48 * frames, 48);
  for (let f = 0; f < frames; f++) {
    const [cv, ctx] = makeCanvas(48, 48);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const dx = x - 24, dy = (y - 24) * 1.15;
      const d = Math.hypot(dx, dy);
      if (d > 21) continue;
      const a = Math.atan2(dy, dx) + d * 0.22 - f * (Math.PI / 4);
      const band = (Math.sin(a * 3) + 1) / 2;
      const col = band > 0.6 ? '#8fe3ff' : band > 0.3 ? '#4a7bd8' : '#7a3fd0';
      px(ctx, x, y, 1, 1, d > 19 ? '#d9f4ff' : col);
    }
    outline(ctx, 48, 48, '#1b1424');
    sctx.drawImage(cv, f * 48, 0);
  }
  return sheet;
}

export function drawEnergyOrb() {
  return c(10, 10, (ctx) => { circle(ctx, 5, 5, 3, '#3a8cff'); px(ctx, 4, 4, 2, 2, '#bfe0ff'); });
}

export function drawCoin() {
  return c(10, 10, (ctx) => { circle(ctx, 5, 5, 3, '#f2c94c'); px(ctx, 4, 3, 1, 4, '#fff2a8'); px(ctx, 6, 4, 1, 3, '#c9971f'); });
}

/** Maçã para o professor: recupera 2 de vida. */
export function drawApple() {
  return c(12, 13, (ctx) => {
    circle(ctx, 6, 7, 4, '#e03a3a'); px(ctx, 4, 5, 2, 2, '#ff9a9a'); px(ctx, 6, 1, 1, 3, '#6b3a22'); px(ctx, 7, 1, 3, 2, '#3ac46a');
  });
}

export function drawShadow() {
  const [cv, ctx] = makeCanvas(24, 8);
  ctx.fillStyle = 'rgba(10,6,20,0.38)';
  ctx.beginPath();
  ctx.ellipse(12, 4, 11, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

export function drawSpawnCircle() {
  const [cv, ctx] = makeCanvas(36, 18);
  ctx.strokeStyle = '#c86bff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(18, 9, 16, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,107,255,0.25)';
  ctx.fill();
  return cv;
}

export function drawCrosshair() {
  return c(17, 17, (ctx) => {
    ring(ctx, 8, 8, 5, '#ffffff');
    px(ctx, 8, 0, 1, 4, '#ffffff'); px(ctx, 8, 13, 1, 4, '#ffffff');
    px(ctx, 0, 8, 4, 1, '#ffffff'); px(ctx, 13, 8, 4, 1, '#ffffff');
    px(ctx, 8, 8, 1, 1, '#ff4d6d');
  });
}

export function drawDoorBar() {
  return c(32, 32, (ctx) => {
    px(ctx, 2, 2, 28, 28, '#5a2a2a');
    for (let x = 4; x < 30; x += 6) { px(ctx, x, 2, 3, 28, '#d94a4a'); px(ctx, x, 2, 1, 28, '#ff8a8a'); }
    px(ctx, 2, 2, 28, 3, '#f2c94c'); px(ctx, 2, 27, 28, 3, '#f2c94c');
    for (let x = 2; x < 30; x += 4) { px(ctx, x, 2, 2, 3, '#1b1424'); px(ctx, x + 2, 27, 2, 3, '#1b1424'); }
  }, false);
}

export function drawPixel() {
  const [cv, ctx] = makeCanvas(4, 4);
  px(ctx, 0, 0, 4, 4, '#ffffff');
  return cv;
}

export function drawSoftCircle(r = 32) {
  const [cv, ctx] = makeCanvas(r * 2, r * 2);
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return cv;
}

export function drawIcon(kind) {
  switch (kind) {
    case 'heart': return c(12, 11, (ctx) => {
      px(ctx, 1, 2, 4, 4, '#e04848'); px(ctx, 6, 2, 4, 4, '#e04848'); px(ctx, 2, 1, 2, 1, '#e04848'); px(ctx, 7, 1, 2, 1, '#e04848');
      px(ctx, 2, 6, 7, 2, '#e04848'); px(ctx, 3, 8, 5, 1, '#e04848'); px(ctx, 4, 9, 3, 1, '#e04848'); px(ctx, 2, 2, 2, 2, '#ff9a9a');
    });
    case 'shield': return c(12, 12, (ctx) => {
      px(ctx, 1, 1, 9, 6, '#9aa7b8'); px(ctx, 2, 7, 7, 2, '#9aa7b8'); px(ctx, 3, 9, 5, 1, '#9aa7b8'); px(ctx, 4, 10, 3, 1, '#9aa7b8'); px(ctx, 2, 2, 3, 3, '#d8e0ea');
    });
    case 'energy': return c(10, 12, (ctx) => {
      dots(ctx, [[5, 1], [4, 2], [5, 2], [3, 3], [4, 3], [2, 4], [3, 4], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [5, 6], [6, 6], [4, 7], [5, 7], [4, 8], [3, 9], [4, 9], [3, 10]], '#4aa8ff');
    });
    case 'coin': return drawCoin();
    case 'lock': return c(16, 18, (ctx) => {
      ring(ctx, 8, 6, 4, '#c9d1d9', 2); px(ctx, 2, 8, 12, 9, '#f2c94c'); px(ctx, 7, 11, 2, 3, '#3a2412');
    });
    default: return c(8, 8, (ctx) => px(ctx, 1, 1, 6, 6, '#ffffff'));
  }
}
