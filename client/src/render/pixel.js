// Utilitários de pixel art em canvas (usados para gerar os sprites provisórios).

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function px(ctx, x, y, w = 1, h = 1, color) {
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Pinta uma lista de pontos [x, y]. */
export function dots(ctx, points, color) {
  ctx.fillStyle = color;
  for (const [x, y] of points) ctx.fillRect(x, y, 1, 1);
}

export function circle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.8) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

export function ring(ctx, cx, cy, r, color, thickness = 1) {
  ctx.fillStyle = color;
  for (let y = -r - 1; y <= r + 1; y++) {
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r + 0.5 && d > r - thickness + 0.5 - 0.01) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** amt > 0 clareia, amt < 0 escurece (-1..1). */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

export function hexToInt(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

/** Contorno escuro de 1px em volta de todos os pixels opacos (visual "Soul Knight"). */
export function outline(ctx, w, h, color = '#1b1424') {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const [r, g, b] = hexToRgb(color);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 100;
  const mark = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) mark.push((y * w + x) * 4);
    }
  }
  for (const i of mark) {
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Ruído determinístico para texturas de chão. */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Mistura duas cores (t = 0 -> a, t = 1 -> b). */
export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
