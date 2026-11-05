import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, data, dummy, withWeapon, arena } from './helpers.js';

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
