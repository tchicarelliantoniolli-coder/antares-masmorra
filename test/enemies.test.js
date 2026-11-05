import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run } from './helpers.js';
import { predictAim, nearestTarget } from '../shared/sim/inimigos/Enemy.js';
import { createEnemy } from '../shared/sim/inimigos/Enemy.js';
import { createArea } from '../shared/sim/areas.js';
import { createAlly } from '../shared/sim/personagens/Allies.js';
import { serializeWorld, decodeSnapshot } from '../shared/net/snapshot.js';
import { data } from './helpers.js';

test('predictAim mira à frente de alvo em movimento', () => {
  const e = { x: 0, y: 0 };
  const alvo = { x: 200, y: 0, vx: 0, vy: -100 };
  const direto = predictAim(e, { x: 200, y: 0 }, 200);
  assert.equal(direto, 0);
  const a = predictAim(e, alvo, 200);
  assert.ok(a < direto, 'ângulo menor que o direto (alvo sobe, y negativo)');
  assert.ok(predictAim(e, alvo, 200, 0) === 0, 'lead 0 = mira direta');
});

test('nearestTarget prefere aliado com taunt mais perto que o jogador', () => {
  const { w, p } = arena();
  const e = createEnemy(w, 'caderno_zumbi', p.x + 200, p.y, -1, { spawnTime: 0 });
  assert.equal(nearestTarget(w, e), p);
  const naoTaunt = createAlly(w, 'planta', e.x - 20, e.y, { hp: 10, ownerId: p.id, life: 10 });
  assert.equal(nearestTarget(w, e), p, 'aliado sem taunt é ignorado');
  naoTaunt.dead = true;
  const a = createAlly(w, 'planta', e.x - 50, e.y, { taunt: true, hp: 10, ownerId: p.id, life: 10 });
  assert.equal(nearestTarget(w, e), a);
  a.hp = 0;
  assert.equal(nearestTarget(w, e), p);
});

test('ink_trail deixa o jogador lento e some depois de life', () => {
  const { w, p } = arena();
  createArea(w, 'ink_trail', p.x, p.y, { r: 30, life: 3 });
  run(w, 0.1);
  assert.ok(p.slowTimer > 0);
  assert.equal(w.areas.filter((a) => a.kind === 'ink_trail' && !a.dead).length, 1);
  run(w, 3.2);
  assert.equal(w.areas.filter((a) => a.kind === 'ink_trail').length, 0);
});

test('fire_ground machuca jogador a cada 0,6 s', () => {
  const { w, p } = arena();
  p.invuln = 0; p.shield = 0;
  const hp0 = p.hp;
  createArea(w, 'fire_ground', p.x, p.y, { r: 30, life: 3, damage: 1 });
  run(w, 0.5);
  assert.equal(p.hp, hp0, 'sem dano antes de 0,6 s');
  run(w, 0.2);
  assert.equal(p.hp, hp0 - 1, 'primeiro tick em 0,6 s');
  run(w, 1.2);
  assert.ok(p.hp <= hp0 - 2, 'segundo tick depois');
});

test('snapshot leva flags e affix do inimigo', () => {
  const { w, p } = arena();
  const e = createEnemy(w, 'caderno_zumbi', p.x + 100, p.y, -1, { spawnTime: 0 });
  e.shielded = true; e.burrowed = true; e.status.confused = 2; e.linked = true; e.affix = 'veloz';
  const s = decodeSnapshot(data, JSON.parse(JSON.stringify(serializeWorld(w))));
  const d = s.enemies.find((x) => x.id === e.id);
  assert.equal(d.shielded, true);
  assert.equal(d.burrowed, true);
  assert.ok(d.status.confused);
  assert.equal(d.linked, true);
  assert.equal(d.affix, 'veloz');
  const e2 = createEnemy(w, 'caderno_zumbi', p.x - 100, p.y, -1, { spawnTime: 0 });
  const d2 = decodeSnapshot(data, JSON.parse(JSON.stringify(serializeWorld(w)))).enemies.find((x) => x.id === e2.id);
  assert.equal(!!d2.shielded, false);
  assert.equal(!!d2.affix, false);
});
