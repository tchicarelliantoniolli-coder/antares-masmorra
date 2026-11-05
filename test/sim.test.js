import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, putInRoom, run, data } from './helpers.js';
import { hurtPlayer, damageEnemy } from '../shared/sim/combat.js';
import { createPickup } from '../shared/sim/salas/Pickups.js';
import { World } from '../shared/sim/World.js';
import { TILE } from '../shared/sim/constants.js';

test('dano vai primeiro no escudo, depois na vida, com invulnerabilidade', () => {
  const w = makeWorld();
  const p = w.players[0];
  const hp = p.hp, sh = p.shield;
  hurtPlayer(w, p, 2);
  assert.equal(p.shield, sh - 2);
  assert.equal(p.hp, hp);
  hurtPlayer(w, p, 2); // invulnerável
  assert.equal(p.shield, sh - 2);
  p.invuln = 0;
  hurtPlayer(w, p, sh); // zera escudo e tira 2 de vida
  assert.equal(p.shield, 0);
  assert.equal(p.hp, hp - 2);
});

test('escudo regenera depois de alguns segundos sem dano', () => {
  const w = makeWorld();
  const p = w.players[0];
  p.shield = 0;
  run(w, 7);
  assert.ok(p.shield >= 2, `escudo ${p.shield}`);
});

test('entrar numa sala de combate tranca as portas; matar todos destranca', () => {
  const w = makeWorld();
  const p = w.players[0];
  const room = w.rooms.find((r) => r.type === 'combat');
  putInRoom(w, p, room);
  run(w, 0.1);
  assert.equal(room.state, 'active');
  assert.ok(w.map.locked.has(room.id));
  for (let wave = 0; wave < 5 && room.state === 'active'; wave++) {
    run(w, 1.5);
    for (const e of w.enemies) { e.spawning = 0; damageEnemy(w, e, 9999); }
    run(w, 1.2);
  }
  assert.equal(room.state, 'cleared');
  assert.ok(!w.map.locked.has(room.id));
});

test('sem energia a arma não dispara (arma inicial é grátis)', () => {
  const w = makeWorld();
  const p = w.players[0];
  p.weapons = ['pistola_grampos'];
  p.energy = 0;
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.equal(w.projectiles.length, 0);
  p.weapons = ['numeros_sinais'];
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.ok(w.projectiles.length > 0);
});

test('Cálculo Mental (Harilson) reduz o custo de energia', () => {
  const w = makeWorld();
  const p = w.players[0];
  p.weapons = ['escopeta_clipes'];
  const before = p.energy;
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  assert.equal(before - p.energy, 3 * 0.75);
});

test('pegar arma do chão: 2 slots, a atual fica no chão; Q troca', () => {
  const w = makeWorld();
  const p = w.players[0];
  createPickup(w, 'weapon', p.x + 10, p.y, { weaponId: 'regua_espada' });
  run(w, 1 / 60, { p1: { interact: true } });
  assert.deepEqual(p.weapons, ['numeros_sinais', 'regua_espada']);
  assert.equal(p.cur, 1);
  createPickup(w, 'weapon', p.x + 10, p.y, { weaponId: 'cajado_tesla' });
  run(w, 1 / 60, { p1: { interact: true } });
  assert.deepEqual(p.weapons, ['numeros_sinais', 'cajado_tesla']);
  assert.ok(w.pickups.some((k) => k.kind === 'weapon' && k.weaponId === 'regua_espada'));
  run(w, 1 / 60, { p1: { swap: true } });
  assert.equal(p.cur, 0);
});

test('baú solta uma arma', () => {
  const w = makeWorld();
  const p = w.players[0];
  const chest = w.pickups.find((k) => k.kind === 'chest');
  p.x = chest.x; p.y = chest.y + 20;
  run(w, 1 / 60, { p1: { interact: true } });
  assert.ok(chest.opened);
  assert.ok(w.pickups.some((k) => k.kind === 'weapon'));
});

test('Equação (Harilson): próximo acerto causa dano x5', () => {
  const w = makeWorld();
  const p = w.players[0];
  run(w, 1 / 60, { p1: { skill: true } });
  assert.equal(p.buffs.nextHitMul, 5);
  const room = w.rooms.find((r) => r.type === 'combat');
  const e = w.enemies[0] || null;
  const { createEnemy } = awaitImport;
  const en = createEnemy(w, 'caderno_zumbi', p.x + 40, p.y, room.id, { spawnTime: 0 });
  en.hp = en.maxHp = 100;
  const dealt = damageEnemy(w, en, 3, { source: p });
  assert.equal(dealt, 15);
  assert.equal(p.buffs.nextHitMul, 1);
});

test('co-op: colega parado e sem atirar por 5 s levanta quem caiu; todos caídos = derrota', () => {
  const w = new World({ data, seed: 5, players: [{ id: 'a', characterId: 'harilson' }, { id: 'b', characterId: 'ana_claudia' }] });
  const [a, b] = w.players;
  a.shield = 0; hurtPlayer(w, a, 99);
  assert.ok(a.downed);
  b.x = a.x + 20; b.y = a.y;
  run(w, 4.5);
  assert.ok(a.downed, 'ainda não: precisa de 5 s');
  run(w, 0.7);
  assert.ok(!a.downed, 'deveria ter levantado');
  assert.ok(a.hp > 0);
  a.invuln = b.invuln = 0; a.shield = b.shield = 0;
  hurtPlayer(w, a, 99); hurtPlayer(w, b, 99);
  run(w, 0.1);
  assert.equal(w.state, 'defeat');
});

test('revive zera se o colega se mexer ou atirar', () => {
  const w = new World({ data, seed: 5, players: [{ id: 'a', characterId: 'harilson' }, { id: 'b', characterId: 'ana_claudia' }] });
  const [a, b] = w.players;
  a.shield = 0; hurtPlayer(w, a, 99);
  b.x = a.x + 20; b.y = a.y;
  run(w, 3);
  assert.ok(a.downed && a.reviveProgress > 2.5, `progresso ${a.reviveProgress}`);
  run(w, 0.1, { b: { fire: true, aim: Math.PI } });
  assert.equal(a.reviveProgress, 0, 'atirou: zera');
  run(w, 3);
  assert.ok(a.downed && a.reviveProgress > 2.5, `progresso ${a.reviveProgress}`);
  run(w, 0.05, { b: { moveX: 0.01, moveY: 1 } });
  assert.equal(a.reviveProgress, 0, 'mexeu: zera');
});

test('derrotar o chefe abre o portal; no último andar, entrar nele = vitória', () => {
  const w = makeWorld({ maxFloors: 1 });
  const p = w.players[0];
  const room = w.rooms[w.bossRoomId];
  putInRoom(w, p, room);
  p.y += 3 * TILE;
  run(w, 0.1);
  assert.ok(w.boss, 'chefe deveria nascer');
  run(w, 2);
  damageEnemy(w, w.boss, 99999);
  run(w, 0.2);
  assert.ok(room.bossDefeated);
  const portal = w.pickups.find((k) => k.kind === 'portal');
  assert.ok(portal);
  p.invuln = 99;
  p.x = portal.x; p.y = portal.y;
  run(w, 1 / 60, { p1: { interact: true } });
  assert.equal(w.state, 'victory');
});

test('simulação aguenta 40 partidas aleatórias sem erro', () => {
  const chars = ['harilson', 'ana_claudia'];
  for (let seed = 1; seed <= 40; seed++) {
    const w = new World({ data, seed, players: [{ id: 'p', characterId: chars[seed % 2] }] });
    const p = w.players[0];
    p.weapons = [data.rollWeapon(w.rng, null), data.rollWeapon(w.rng, null)];
    p.invuln = 0;
    let dir = 0;
    run(w, 40, (world, i) => {
      if (i % 90 === 0) dir = world.rng.range(0, Math.PI * 2);
      const e = world.enemies[0];
      const aim = e ? Math.atan2(e.y - p.y, e.x - p.x) : dir;
      return { p: { moveX: Math.cos(dir), moveY: Math.sin(dir), aim, fire: true, skill: i % 300 === 0, swap: i % 200 === 0, interact: i % 50 === 0 } };
    });
    assert.ok(['playing', 'defeat', 'victory'].includes(w.state));
  }
});

const awaitImport = await import('../shared/sim/inimigos/Enemy.js');
