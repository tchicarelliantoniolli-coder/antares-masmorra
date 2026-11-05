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
