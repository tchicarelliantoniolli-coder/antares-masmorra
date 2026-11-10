#!/usr/bin/env node
/**
 * Tabela de dano por segundo de cada arma contra um alvo parado (média de 10 s, com crítico).
 *   node scripts/weapon-dps.mjs [id ...]
 * Marca "FORA DA FAIXA" quando a arma sai da faixa da raridade (veja BANDS), medida a 120 px.
 * Marca "ROUBADA ENCOSTADO" quando, encostado ou dentro de um alvo do tamanho de um chefe,
 * a arma passa de PB_MAX vezes o teto da faixa (leques e lança-chamas ganham bônus de perto, mas limitado).
 */
import { loadGameDataNode } from '../shared/sim/loadDataNode.js';
import { World } from '../shared/sim/World.js';
import { createEnemy } from '../shared/sim/inimigos/Enemy.js';
import { TILE, T } from '../shared/sim/constants.js';

const data = loadGameDataNode();
const SECONDS = 10;

// Faixas de dano/s num alvo. Iniciais têm faixa própria.
// Encostado num chefe, uma arma pode chegar a no máximo PB_MAX × o teto da faixa.
const PB_MAX = 1.5;
const BANDS = { inicial: [10, 15], comum: [10, 16], incomum: [13, 19], rara: [16, 24], epica: [20, 30], lendaria: [26, 40] };
// Armas de área/controle podem ficar até 30% abaixo do mínimo.
const isUtility = (w) => ['singularity', 'rain', 'deploy'].includes(w.mode) || w.melee?.style === 'shield' || !!w.projectile?.pool || !!w.lob?.pool ||
  (w.projectile?.count >= 10 && w.projectile?.spread >= 300); // anel em volta (acerta muitos de uma vez)

function arena(seed) {
  const w = new World({ data, seed, players: [{ id: 'p1', characterId: 'ana_claudia' }] });
  const p = w.players[0];
  p.mods.critBonus = 0; // sem o passivo da Ana Cláudia: crítico só da arma
  const room = w.rooms.find((r) => r.type === 'combat');
  // sala de teste vazia: tira obstáculos, objetos e as paredes internas da forma/layout sorteados (só a borda fica)
  for (let ty = room.y0 + 1; ty < room.y0 + room.h - 1; ty++) {
    for (let tx = room.x0 + 1; tx < room.x0 + room.w - 1; tx++) {
      if (w.map.get(tx, ty) !== T.FLOOR) { w.map.set(tx, ty, T.FLOOR); w.map.props.delete(w.map.idx(tx, ty)); }
    }
  }
  w.map.traps = [];
  p.x = (room.cx + 0.5) * TILE;
  p.y = (room.cy + 0.5) * TILE;
  room.state = 'cleared';
  p.energy = p.maxEnergy = 1e9;
  return { w, p };
}

/**
 * Dano por segundo num alvo parado. Sem `at`, usa a distância padrão da arma e um alvo comum.
 * Com `at = { dist, radius }`, mede encostado/dentro de um alvo do tamanho de um chefe.
 */
function measure(id, seed = 7, at = null) {
  const wp = data.weapon(id);
  const { w, p } = arena(seed);
  p.weapons = [id];
  const melee = wp.type === 'melee';
  const style = wp.melee?.style;
  const dist = at ? at.dist : melee && style !== 'thrust' ? 30 : wp.mode === 'deploy' ? 40 : 120;
  const e = createEnemy(w, 'caderno_zumbi', p.x + dist, p.y, -1, { spawnTime: 0 });
  e.def = { ...e.def, behavior: 'none', contactDamage: 0, drops: {} };
  if (at) e.r = at.radius;
  e.hp = e.maxHp = 1e9;
  const x0 = e.x, y0 = e.y;
  const e0 = p.energy;
  const steps = SECONDS * 60;
  for (let i = 0; i < steps; i++) {
    let fire = true;
    if (wp.mode === 'charge' && p.wstate?.chargeFull) fire = false;
    if (style === 'shield') fire = i % 30 < 20;
    w.step(1 / 60, { p1: { fire, aim: at ? 0 : Math.atan2(e.y - p.y, e.x - p.x), aimDist: Math.max(30, Math.hypot(e.x - p.x, e.y - p.y)) } });
    w.events.length = 0;
    e.x = x0; e.y = y0; e.kx = e.ky = 0; // alvo não sai do lugar
    if (at && !p.dash) { p.x = x0 - at.dist; p.y = y0; } // jogador fica grudado no chefe
    else if (style === 'thrust' && !p.dash) { p.x = x0 - 100; p.y = y0; }
  }
  return { dps: (1e9 - e.hp) / SECONDS, eps: (e0 - p.energy) / SECONDS };
}

const only = process.argv.slice(2);
const rows = [];
for (const w of data.weapons.values()) {
  if (only.length && !only.includes(w.id)) continue;
  const seeds = [7, 8, 9];
  const runs = seeds.map((s) => measure(w.id, s));
  const dps = runs.reduce((a, r) => a + r.dps, 0) / runs.length;
  const eps = runs.reduce((a, r) => a + r.eps, 0) / runs.length;
  // encostado: dentro do chefe (raio 20 e 26) e com o corpo encostando nele
  const pbAt = [{ dist: 0, radius: 20 }, { dist: 22, radius: 20 }, { dist: 0, radius: 26 }];
  const pb = Math.max(...pbAt.map((at) => seeds.reduce((a, s) => a + measure(w.id, s, at).dps, 0) / seeds.length));
  const band = BANDS[w.starterOnly ? 'inicial' : w.rarity];
  const min = isUtility(w) ? band[0] * 0.7 : band[0];
  const out = dps < min || dps > band[1];
  const pbOut = pb > band[1] * PB_MAX;
  rows.push({ id: w.id, rar: w.starterOnly ? 'inicial' : w.rarity, mode: w.type === 'melee' ? 'melee:' + w.melee.style : w.mode, dps, eps, pb, band, out, pbOut });
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('arma', 26) + pad('raridade', 10) + pad('modo', 14) + pad('dano/s', 8) + pad('encostado', 10) + pad('energia/s', 10) + 'faixa');
for (const r of rows) {
  console.log(pad(r.id, 26) + pad(r.rar, 10) + pad(r.mode, 14) + pad(r.dps.toFixed(1), 8) + pad(r.pb.toFixed(1), 10) + pad(r.eps.toFixed(1), 10) + `${r.band[0]}–${r.band[1]}` +
    (r.out ? '  FORA DA FAIXA' : '') + (r.pbOut ? `  ROUBADA ENCOSTADO (máx. ${(r.band[1] * PB_MAX).toFixed(0)})` : ''));
}
const bad = rows.filter((r) => r.out).length;
const pbBad = rows.filter((r) => r.pbOut).length;
console.log(`\n${rows.length} armas, ${bad} fora da faixa, ${pbBad} roubadas encostado`);
process.exit(bad || pbBad ? 1 : 0);
