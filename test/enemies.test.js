import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run } from './helpers.js';
import { predictAim, nearestTarget } from '../shared/sim/inimigos/Enemy.js';
import { createEnemy } from '../shared/sim/inimigos/Enemy.js';
import { createArea } from '../shared/sim/areas.js';
import { createAlly } from '../shared/sim/personagens/Allies.js';
import { serializeWorld, decodeSnapshot } from '../shared/net/snapshot.js';
import { data } from './helpers.js';
import { damageEnemy } from '../shared/sim/combat.js';

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

// ---------------------------------------------------------------- Task 2: inimigos atuais

import { makeWorld, putInRoom } from './helpers.js';

const inimigosHostis = (w) => w.projectiles.filter((pr) => pr.team === 'enemy' && !pr.dead);

test('caderno: bote mostra aviso antes e deixa rastro de tinta', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const e = createEnemy(w, 'caderno_zumbi', p.x - 60, p.y, -1, { spawnTime: 0 });
  e.cd = 0;
  let vistoAviso = false;
  for (let i = 0; i < 60 && e.state !== 'lunge'; i++) {
    w.step(1 / 60, {});
    if (e.state === 'windup' && e.telegraph?.type === 'line') vistoAviso = true;
  }
  assert.ok(vistoAviso, 'aviso line durante o preparo');
  assert.equal(e.state, 'lunge');
  assert.equal(e.telegraph, null, 'aviso some quando o bote começa');
  run(w, 0.35);
  const rastro = w.areas.filter((a) => a.kind === 'ink_trail');
  assert.ok(rastro.length >= 3, 'rastro de tinta ao longo do bote: ' + rastro.length);
});

test('prova: rajada de 3 com mira prevista', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const e = createEnemy(w, 'prova_voadora', p.x + 200, p.y, -1, { spawnTime: 0 });
  e.cd = 0;
  const angulos = [];
  const vistos = new Set();
  for (let i = 0; i < 90; i++) {
    w.step(1 / 60, { p1: { moveY: -1 } }); // jogador sobe
    for (const pr of inimigosHostis(w)) if (!vistos.has(pr.id)) { vistos.add(pr.id); angulos.push({ a: Math.atan2(pr.vy, pr.vx), x: e.x, y: e.y, px: p.x, py: p.y }); }
  }
  assert.equal(angulos.length, 3, 'três tiros na rajada');
  const primeiro = angulos[0];
  const direto = Math.atan2(primeiro.py - primeiro.y, primeiro.px - primeiro.x);
  assert.notEqual(primeiro.a.toFixed(3), direto.toFixed(3), 'mira à frente do jogador');
});

test('estojo: fechado não leva dano; aberto leva', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const e = createEnemy(w, 'estojo', p.x + 150, p.y, -1, { spawnTime: 0 });
  e.cd = 1;
  w.step(1 / 60, {});
  assert.equal(e.state, 'closed');
  assert.ok(e.shielded > 0);
  assert.equal(damageEnemy(w, e, 5), 0, 'fechado: imune');
  let aberto = false;
  for (let i = 0; i < 240 && !aberto; i++) { w.step(1 / 60, {}); aberto = e.state === 'open'; }
  assert.ok(aberto, 'abre depois do intervalo');
  assert.equal(e.shielded, 0);
  assert.ok(damageEnemy(w, e, 1) > 0, 'aberto: leva dano');
  run(w, 3);
  assert.equal(e.state, 'closed', 'fecha de novo depois de openTime');
  assert.ok(e.shielded > 0);
});

test('lousa: tiros saem em ângulos que giram ao longo do ataque', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const e = createEnemy(w, 'lousa', p.x + 150, p.y, -1, { spawnTime: 0 });
  e.cd = 0;
  const porVolley = [];
  const vistos = new Set();
  for (let i = 0; i < 120; i++) {
    w.step(1 / 60, {});
    const novos = inimigosHostis(w).filter((pr) => !vistos.has(pr.id));
    novos.forEach((pr) => vistos.add(pr.id));
    if (novos.length) porVolley.push(novos.map((pr) => Math.atan2(pr.vy, pr.vx)));
  }
  assert.ok(porVolley.length >= 4, 'várias salvas: ' + porVolley.length);
  assert.equal(porVolley[0].length, 3, 'três braços');
  assert.notEqual(porVolley[0][0].toFixed(2), porVolley[3][0].toFixed(2), 'ângulo gira');
});

test('mochila: aviso circular no pavio e chão em chamas depois', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const e = createEnemy(w, 'mochila', p.x - 100, p.y, -1, { spawnTime: 0 });
  let aviso = null;
  for (let i = 0; i < 240 && !e.dead; i++) {
    w.step(1 / 60, {});
    if (e.state === 'fuse' && e.telegraph) aviso = { ...e.telegraph };
  }
  assert.ok(aviso && aviso.type === 'circle' && aviso.r >= 50, 'aviso circular com o raio da explosão');
  assert.ok(e.dead);
  const fogo = w.areas.filter((a) => a.kind === 'fire_ground' && !a.dead);
  assert.ok(fogo.length >= 1, 'chão em chamas');
  assert.ok(fogo[0].life >= 3);
});

test('sala com estojo fechado destranca quando todos morrem', () => {
  const w = makeWorld();
  const p = w.players[0];
  const room = w.rooms.find((r) => r.type === 'combat');
  room.waves = [['estojo', 'estojo']];
  putInRoom(w, p, room);
  p.energy = p.maxEnergy = 9999;
  p.invuln = 99;
  for (let i = 0; i < 400 && w.activeRoom !== room; i++) w.step(1 / 60, {});
  run(w, 1.2, {}); // onda nasce
  const estojos = w.enemies.filter((e) => e.type === 'estojo' && !e.dead);
  assert.equal(estojos.length, 2);
  estojos.forEach((e) => { e.hp = 5; e.cd = 0.2; });
  const matar = () => { for (const e of estojos) if (!e.dead && e.state === 'open') damageEnemy(w, e, 999); };
  for (let i = 0; i < 60 * 8 && room.state !== 'cleared'; i++) { w.step(1 / 60, {}); matar(); }
  assert.equal(room.state, 'cleared');
  assert.ok(estojos.every((e) => e.dead));
});
