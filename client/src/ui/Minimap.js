import { CELL, TILE } from '/shared/sim/constants.js';
import { COLORS } from '../config.js';

const C = 26; // pixels por célula da grade de salas

const TYPE_COLOR = {
  start: 0x8a83ad, combat: 0x6b5fa8, chest: 0xc9a227, heal: 0x3ac46a, boss: 0xb83a3a
};

/**
 * Desenha o minimapa no canto (alinhado à direita em `right`, topo em `top`).
 * Mostra salas visitadas (cheias), descobertas (só contorno) e o jogador.
 * Retorna a caixa usada { bottom }.
 */
export function drawMinimap(g, world, player, right, top, time) {
  g.clear();
  const rooms = world.rooms;
  const showAll = player.mods?.revealMap;
  const visible = rooms.filter((r) => r.discovered || showAll);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.gx); minY = Math.min(minY, r.gy);
    maxX = Math.max(maxX, r.gx); maxY = Math.max(maxY, r.gy);
  }
  const w = (maxX - minX + 1) * C + 12, h = (maxY - minY + 1) * C + 12;
  const left = right - w;
  g.fillStyle(0x000000, 0.35).fillRect(left + 3, top + 3, w, h);
  g.fillStyle(COLORS.panel, 0.85).fillRect(left, top, w, h);
  g.lineStyle(2, COLORS.border, 1).strokeRect(left + 1, top + 1, w - 2, h - 2);
  const ox = left + 6, oy = top + 6;
  const center = (r) => [ox + (r.gx - minX) * C + C / 2, oy + (r.gy - minY) * C + C / 2];

  // corredores
  g.lineStyle(3, 0x8a83ad, 0.9);
  for (const r of visible) {
    for (const id of r.links) {
      const o = rooms[id];
      if (o.id < r.id && (o.discovered || showAll)) {
        if (!(r.visited || o.visited || showAll)) continue;
        const [x1, y1] = center(r), [x2, y2] = center(o);
        g.lineBetween(x1, y1, x2, y2);
      }
    }
  }
  // salas
  for (const r of visible) {
    const [cx, cy] = center(r);
    const rw = Math.max(8, (r.w / CELL) * C * 0.95), rh = Math.max(8, (r.h / CELL) * C * 0.95);
    const x = cx - rw / 2, y = cy - rh / 2;
    if (r.visited || showAll) {
      let col = TYPE_COLOR[r.type] || 0x6b5fa8;
      if (r.state === 'active') col = 0xe04848;
      g.fillStyle(col, r.visited ? 1 : 0.5).fillRect(x, y, rw, rh);
    } else {
      g.fillStyle(0x0d0b14, 0.9).fillRect(x, y, rw, rh);
    }
    g.lineStyle(1, 0xffffff, r.visited ? 0.5 : 0.3).strokeRect(x, y, rw, rh);
    // ícones
    if (r.type === 'chest') g.fillStyle(0xffd23f, 1).fillRect(cx - 2, cy - 2, 5, 4);
    if (r.type === 'heal') { g.fillStyle(0xffffff, 1).fillRect(cx - 1, cy - 3, 3, 7); g.fillRect(cx - 3, cy - 1, 7, 3); }
    if (r.type === 'boss') { g.fillStyle(0xffffff, 1).fillCircle(cx, cy - 1, 3); g.fillRect(cx - 2, cy + 1, 5, 3); g.fillStyle(0x000000, 1).fillRect(cx - 2, cy - 2, 1, 1).fillRect(cx + 1, cy - 2, 1, 1); }
  }
  // jogadores
  for (const p of world.players) {
    const px = ox + (p.x / TILE / CELL - minX) * C;
    const py = oy + (p.y / TILE / CELL - minY) * C;
    const blink = p === player ? (Math.floor(time / 250) % 2 ? 0xffffff : 0xffd23f) : 0x5ef2ff;
    g.fillStyle(0x000000, 1).fillRect(px - 2, py - 2, 5, 5);
    g.fillStyle(blink, 1).fillRect(px - 1, py - 1, 3, 3);
  }
  return { bottom: top + h };
}
