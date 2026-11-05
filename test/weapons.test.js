import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, data, dummy, withWeapon, arena, wallDistRight, countEvents } from './helpers.js';
import { energyCost } from '../shared/sim/armas/Weapons.js';

test('shot sem mode dispara igual a antes', () => {
  const { w, p } = arena();
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.ok(w.projectiles.length > 0);
  assert.equal(p.wstate.weaponId, 'numeros_sinais');
});

test('trocar de arma reseta o estado da arma', () => {
  const { w, p } = arena();
  p.weapons = ['pistola_grampos', 'regua_espada'];
  run(w, 1 / 60);
  p.wstate.charge = 0.7;
  run(w, 1 / 60, { p1: { swap: true } });
  assert.equal(p.wstate.weaponId, 'regua_espada');
  assert.equal(p.wstate.charge, 0);
});

test('pegar arma do chão também reseta o estado', () => {
  const { w, p } = arena();
  run(w, 1 / 60);
  p.wstate.charge = 0.7;
  p.weapons[p.cur] = 'escopeta_clipes';
  run(w, 1 / 60);
  assert.equal(p.wstate.weaponId, 'escopeta_clipes');
  assert.equal(p.wstate.charge, 0);
});

test('assinando (Caderno Preto) não atira', () => {
  const { w, p } = arena();
  p.signing = 2;
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.equal(w.projectiles.length, 0);
});

test('jogador guarda a distância da mira', () => {
  const { w, p } = arena();
  run(w, 1 / 60, { p1: { aim: 0, aimDist: 150 } });
  assert.equal(p.aimDist, 150);
});

// ---------------------------------------------------------------- modos discretos
test('burst: um clique solta 3 tiros e cobra energia uma vez', () => {
  const { w, p } = arena();
  const wp = withWeapon(w, { mode: 'burst', energyCost: 4, fireRate: 0.5, burst: { count: 3, interval: 0.07 } });
  const e0 = p.energy;
  run(w, 0.4, { p1: { fire: true, aim: 0 } });
  assert.equal(countEvents(w, 'shoot'), 3);
  assert.equal(e0 - p.energy, energyCost(p, wp));
});

test('burst: a rajada termina mesmo soltando o botão', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'burst', fireRate: 0.5, burst: { count: 4, interval: 0.1 } });
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  run(w, 0.5, { p1: { fire: false, aim: 0 } });
  assert.equal(countEvents(w, 'shoot'), 4);
});

test('charge: segurar não atira; soltar com carga cheia dá dano maxMul×', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'charge', damage: 4, fireRate: 2, charge: { time: 1, minMul: 0.4, maxMul: 2.5 } });
  run(w, 1.2, { p1: { fire: true, aim: 0 } });
  assert.equal(w.projectiles.length, 0);
  assert.equal(countEvents(w, 'charge_full'), 1);
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.projectiles.length, 1);
  assert.ok(Math.abs(w.projectiles[0].damage - 10) < 1e-9, `dano ${w.projectiles[0].damage}`);
  assert.equal(countEvents(w, 'charge_release'), 1);
});

test('charge: soltar cedo dá tiro fraco; carga cheia aplica perfuração e quantidade extra', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'charge', damage: 4, fireRate: 2, charge: { time: 1, fullPierce: 2, fullCount: 3 } });
  run(w, 0.2, { p1: { fire: true, aim: 0 } });
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.projectiles.length, 1);
  assert.ok(w.projectiles[0].damage < 4);
  p.fireCd = 0;
  w.projectiles = [];
  run(w, 1.1, { p1: { fire: true, aim: 0 } });
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.projectiles.length, 3);
  assert.equal(w.projectiles[0].pierce, 2);
});

test('spinup: segurando, o 2º segundo atira mais que o 1º', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'spinup', fireRate: 10, spinup: { startMul: 0.35, maxMul: 1.6, rampTime: 1.4 } });
  run(w, 1, { p1: { fire: true, aim: 0 } });
  const first = countEvents(w, 'shoot');
  run(w, 1, { p1: { fire: true, aim: 0 } });
  const second = countEvents(w, 'shoot') - first;
  assert.ok(second > first * 1.4, `1º ${first}, 2º ${second}`);
});

test('split: tiro que bate na parede vira 3 filhos com metade do dano, e filho não se divide', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'split', damage: 4, fireRate: 1, projectile: { speed: 600, range: 2000 }, split: { into: 3, childDamageMul: 0.5, spread: 60 } });
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  const t = wallDistRight(w, p) / 600 + 0.1;
  let kids = [];
  for (let i = 0; i < Math.ceil(t * 60) && !kids.length; i++) { run(w, 1 / 60); kids = w.projectiles.filter((q) => q.child); }
  assert.equal(kids.length, 3);
  for (const k of kids) { assert.equal(k.damage, 2); assert.equal(k.split, null); assert.ok(k.vx < 0, 'volta da parede'); }
});

test('singularity: o tiro vira área que puxa inimigo', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'singularity', fireRate: 1, projectile: { speed: 500, range: 2000 }, singularity: { pullRadius: 140, life: 2, dps: 4, pull: 170 } });
  dummy(w, p.x + 120, p.y, 9999);
  const far = dummy(w, p.x + 120, p.y + 90, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  run(w, 0.4);
  const area = w.areas.find((a) => a.kind === 'singularity');
  assert.ok(area, 'criou a área');
  const d0 = Math.hypot(far.x - area.x, far.y - area.y);
  run(w, 0.6);
  assert.ok(Math.hypot(far.x - area.x, far.y - area.y) < d0 - 20, 'puxou');
});

test('variants: 30 disparos usam pelo menos 2 variantes', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'variants', fireRate: 30, variants: { list: [{ speed: 200 }, { speed: 700, damageMul: 2 }] } });
  const keys = new Set();
  for (let i = 0; i < 60; i++) { run(w, 1 / 60, { p1: { fire: true, aim: 0 } }); for (const q of w.projectiles) keys.add(q.sprite); }
  assert.ok(keys.size >= 2, [...keys].join(','));
});

// ---------------------------------------------------------------- modos contínuos
import { T, TILE } from '../shared/sim/constants.js';

/** Põe uma coluna de parede 3 tiles de altura em x (px), na altura do jogador. */
function wallAt(w, p, x) {
  const tx = Math.floor(x / TILE), ty = Math.floor(p.y / TILE);
  for (let dy = -1; dy <= 1; dy++) w.map.set(tx, ty + dy, T.WALL);
}

test('beam acerta inimigo na linha e não acerta atrás da parede', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { dps: 20, tick: 0.1, range: 600, pierce: true, energyPerSec: 0 } });
  const a = dummy(w, p.x + 100, p.y, 9999);
  wallAt(w, p, p.x + 170);
  const b = dummy(w, p.x + 260, p.y, 9999);
  run(w, 1, { p1: { fire: true, aim: 0 } });
  assert.ok(a.hp < 9999 - 15, `a perdeu ${9999 - a.hp}`);
  assert.equal(b.hp, 9999);
  assert.equal(w.beams.length, 1);
  assert.ok(w.beams[0].x2 < p.x + 170, 'raio para na parede');
});

test('beam sem pierce para no primeiro inimigo', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { dps: 20, range: 600, energyPerSec: 0 } });
  const a = dummy(w, p.x + 100, p.y, 9999);
  const b = dummy(w, p.x + 160, p.y, 9999);
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.ok(a.hp < 9999);
  assert.equal(b.hp, 9999);
});

test('beam sem energia não liga e avisa; energia nunca fica negativa', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 6 } });
  p.energy = 0;
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 0);
  assert.ok(countEvents(w, 'no_energy') >= 1);
  assert.ok(p.energy >= 0);
});

test('beam gasta energia por segundo e para quando acaba', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 10 } });
  p.energy = 5;
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 1);
  assert.ok(p.energy < 5);
  run(w, 1, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 0, 'acabou a energia');
  assert.ok(p.energy >= 0);
});

test('beam some quando solta o botão', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 0 } });
  run(w, 0.2, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 1);
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.beams.length, 0);
});

test('flame acerta vários inimigos no cone e não passa da parede', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'flame', damage: 1, fireRate: 12, flame: { range: 140, arc: 40, particles: 2 } });
  const near = [dummy(w, p.x + 70, p.y - 15, 9999), dummy(w, p.x + 90, p.y + 15, 9999)];
  run(w, 1, { p1: { fire: true, aim: 0 } });
  for (const e of near) assert.ok(e.hp < 9999, 'queimou no cone');
  const { w: w2, p: p2 } = arena();
  withWeapon(w2, { mode: 'flame', damage: 1, fireRate: 12, flame: { range: 140, arc: 40, particles: 2 } });
  wallAt(w2, p2, p2.x + 50);
  const hidden = dummy(w2, p2.x + 100, p2.y, 9999);
  run(w2, 1, { p1: { fire: true, aim: 0 } });
  assert.equal(hidden.hp, 9999);
});

// ---------------------------------------------------------------- modos no chão
test('lob cai no ponto mirado e passa por cima de inimigo no caminho', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'lob', damage: 1, fireRate: 1, projectile: { explode: { radius: 40, damage: 10 } }, lob: { maxRange: 400, flightTime: 0.5 } });
  const mid = dummy(w, p.x + 80, p.y, 9999);
  const far = dummy(w, p.x + 200, p.y, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 200 } });
  run(w, 0.3);
  assert.equal(far.hp, 9999, 'ainda no ar');
  assert.ok(w.projectiles.some((q) => q.z > 0), 'tem altura');
  run(w, 0.4);
  assert.equal(mid.hp, 9999, 'passou por cima');
  assert.ok(far.hp < 9999, 'explodiu no alvo');
});

test('lob mirando dentro da parede cai antes da parede', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'lob', fireRate: 1, projectile: { explode: { radius: 30, damage: 5 } }, lob: { maxRange: 500, flightTime: 0.4 } });
  const wx = p.x + 150;
  for (let dy = -2; dy <= 2; dy++) w.map.set(Math.floor(wx / TILE), Math.floor(p.y / TILE) + dy, T.WALL);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 300 } });
  run(w, 0.6);
  const ex = w.events.find((e) => e.type === 'explosion');
  assert.ok(ex, 'explodiu');
  assert.ok(ex.x < Math.floor(wx / TILE) * TILE, `x ${ex.x}`);
  assert.ok(!w.map.solidAt(ex.x, ex.y));
});

test('pool envenena inimigo parado nela', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'lob', fireRate: 1, lob: { maxRange: 400, flightTime: 0.3, pool: { r: 50, life: 3, dps: 4, effect: { type: 'veneno', chance: 1, duration: 2, power: 2 } } } });
  const e = dummy(w, p.x + 150, p.y, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 150 } });
  run(w, 1.2);
  assert.ok(w.areas.some((a) => a.kind === 'pool'));
  assert.ok(e.status.poison, 'envenenado');
  assert.ok(e.hp < 9999);
});

test('rain marca o chão antes de causar dano', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'rain', damage: 5, fireRate: 1, rain: { count: 5, radius: 20, delay: 0.5, hitRadius: 40 } });
  const e = dummy(w, p.x + 150, p.y, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 150 } });
  assert.ok(w.areas.filter((a) => a.kind === 'rain_mark').length >= 5);
  assert.equal(e.hp, 9999);
  run(w, 1);
  assert.ok(e.hp < 9999);
});

test('chain acerta o mais próximo da mira e pula para 2 vizinhos com dano menor', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'chain', damage: 10, fireRate: 1, chain: { range: 300, chains: 2, radius: 130, falloff: 0.8, aimCone: 35 } });
  const a = dummy(w, p.x + 150, p.y, 9999);
  const b = dummy(w, p.x + 150, p.y + 90, 9999);
  const c = dummy(w, p.x + 150, p.y + 180, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  for (const e of [a, b, c]) assert.ok(e.hp < 9999);
  assert.ok(9999 - c.hp < 9999 - a.hp, 'o último salto bate menos');
  assert.equal(countEvents(w, 'chain'), 1);
});

test('chain sem alvo não gasta energia', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'chain', energyCost: 3, fireRate: 2 });
  const e0 = p.energy;
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.equal(p.energy, e0);
  assert.ok(countEvents(w, 'chain') >= 1, 'mostra a faísca curta');
});
