#!/usr/bin/env node
/**
 * Tabela de dano por segundo de cada arma contra um alvo parado (média de 10 s, com crítico).
 *   node scripts/weapon-dps.mjs [id ...]
 * Marca "FORA DA FAIXA" quando a arma sai da faixa da raridade (veja BANDS).
 */
import { loadGameDataNode } from '../shared/sim/loadDataNode.js';
import { World } from '../shared/sim/World.js';
import { createEnemy } from '../shared/sim/inimigos/Enemy.js';
import { TILE, T } from '../shared/sim/constants.js';

const data = loadGameDataNode();
const SECONDS = 10;

// Faixas de dano/s num alvo. Iniciais têm faixa própria.
const BANDS = { inicial: [10, 15], comum: [10, 16], incomum: [13, 19], rara: [16, 24], epica: [20, 30], lendaria: [26, 40] };
// Armas de área/controle podem ficar até 30% abaixo do mínimo.
const isUtility = (w) => ['singularity', 'rain', 'deploy'].includes(w.mode) || w.melee?.style === 'shield' || !!w.projectile?.pool || !!w.lob?.pool ||
  (w.projectile?.count >= 10 && w.projectile?.spread >= 300); // anel em volta (acerta muitos de uma vez)

function arena(seed) {
  const w = new World({ data, seed, players: [{ id: 'p1', characterId: 'ana_claudia' }] });
  const p = w.players[0];
  p.mods.critBonus = 0; // sem o passivo da Ana Cláudia: crítico só da arma
  const room = w.rooms.find((r) => r.type === 'combat');
  for (let ty = room.y0; ty < room.y0 + room.h; ty++) {
    for (let tx = room.x0; tx < room.x0 + room.w; tx++) {
      const t = w.map.get(tx, ty);
      if (t === T.OBSTACLE || t === T.PROP) { w.map.set(tx, ty, T.FLOOR); w.map.props.delete(w.map.idx(tx, ty)); }
    }
  }
  w.map.traps = [];
  p.x = (room.cx + 0.5) * TILE;
  p.y = (room.cy + 0.5) * TILE;
  room.state = 'cleared';
  p.energy = p.maxEnergy = 1e9;
  return { w, p };
}

function measure(id, seed = 7) {
  const wp = data.weapon(id);
  const { w, p } = arena(seed);
  p.weapons = [id];
  const melee = wp.type === 'melee';
  const style = wp.melee?.style;
  const dist = melee && style !== 'thrust' ? 30 : wp.mode === 'deploy' ? 40 : 120;
  const e = createEnemy(w, 'caderno_zumbi', p.x + dist, p.y, -1, { spawnTime: 0 });
  e.def = { ...e.def, behavior: 'none', contactDamage: 0, drops: {} };
  e.hp = e.maxHp = 1e9;
  const x0 = e.x, y0 = e.y;
  const e0 = p.energy;
  const steps = SECONDS * 60;
  for (let i = 0; i < steps; i++) {
    let fire = true;
    if (wp.mode === 'charge' && p.wstate?.chargeFull) fire = false;
    if (style === 'shield') fire = i % 30 < 20;
    w.step(1 / 60, { p1: { fire, aim: Math.atan2(e.y - p.y, e.x - p.x), aimDist: Math.hypot(e.x - p.x, e.y - p.y) } });
    w.events.length = 0;
    e.x = x0; e.y = y0; e.kx = e.ky = 0; // alvo não sai do lugar
    if (style === 'thrust' && !p.dash) { p.x = x0 - 100; p.y = y0; }
  }
  return { dps: (1e9 - e.hp) / SECONDS, eps: (e0 - p.energy) / SECONDS };
}

const only = process.argv.slice(2);
const rows = [];
for (const w of data.weapons.values()) {
  if (only.length && !only.includes(w.id)) continue;
  const runs = [7, 8, 9].map((s) => measure(w.id, s));
  const dps = runs.reduce((a, r) => a + r.dps, 0) / runs.length;
  const eps = runs.reduce((a, r) => a + r.eps, 0) / runs.length;
  const band = BANDS[w.starterOnly ? 'inicial' : w.rarity];
  const min = isUtility(w) ? band[0] * 0.7 : band[0];
  const out = dps < min || dps > band[1];
  rows.push({ id: w.id, rar: w.starterOnly ? 'inicial' : w.rarity, mode: w.type === 'melee' ? 'melee:' + w.melee.style : w.mode, dps, eps, band, out });
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('arma', 26) + pad('raridade', 10) + pad('modo', 14) + pad('dano/s', 8) + pad('energia/s', 10) + 'faixa');
for (const r of rows) {
  console.log(pad(r.id, 26) + pad(r.rar, 10) + pad(r.mode, 14) + pad(r.dps.toFixed(1), 8) + pad(r.eps.toFixed(1), 10) + `${r.band[0]}–${r.band[1]}` + (r.out ? '  FORA DA FAIXA' : ''));
}
const bad = rows.filter((r) => r.out).length;
console.log(`\n${rows.length} armas, ${bad} fora da faixa`);
process.exit(bad ? 1 : 0);
