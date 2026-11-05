import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../shared/sim/World.js';
import { TILE, T } from '../shared/sim/constants.js';
import { damageEnemy, killEnemy, hurtPlayer } from '../shared/sim/combat.js';
import { damageProp } from '../shared/sim/salas/Props.js';
import { interact } from '../shared/sim/salas/Pickups.js';
import { data, run, putInRoom } from './helpers.js';

function beatBoss(w) {
  const p = w.players[0];
  const room = w.rooms[w.bossRoomId];
  putInRoom(w, p, room);
  p.y += 3 * TILE;
  p.invuln = 999;
  run(w, 0.1);
  assert.ok(w.boss, 'chefe deveria nascer no andar ' + w.floorNum);
  run(w, 2);
  killEnemy(w, w.boss, p);
  run(w, 0.2);
  const portal = w.pickups.find((k) => k.kind === 'portal');
  assert.ok(portal, 'portal');
  p.x = portal.x; p.y = portal.y;
  run(w, 1 / 60, { p1: { interact: true } });
}

test('a partida tem 3 andares: Xerox, Katia e Samara; vitória só depois do 3º', () => {
  const w = new World({ data, seed: 77, players: [{ id: 'p1', characterId: 'harilson' }] });
  assert.equal(w.maxFloors, 3);
  const bosses = [];
  for (let f = 1; f <= 3; f++) {
    assert.equal(w.floorNum, f);
    assert.equal(w.state, 'playing');
    w.players[0].weapons = ['rifle_lapis', 'regua_espada'];
    beatBoss(w);
    bosses.push(w.floorNum === f ? w.floorDef.boss : data.floor(f).boss);
  }
  assert.deepEqual(bosses, ['maquina_xerox', 'katia', 'samara']);
  assert.equal(w.state, 'victory');
  // a arma e as moedas continuam entre andares
  assert.deepEqual(w.players[0].weapons, ['rifle_lapis', 'regua_espada']);
});

test('chefes Katia e Samara usam todos os ataques sem erros', () => {
  for (const floor of [2, 3]) {
    for (let seed = 1; seed <= 6; seed++) {
      const w = new World({ data, seed, floor, players: [{ id: 'a', characterId: 'harilson' }, { id: 'b', characterId: 'marina' }] });
      const [a, b] = w.players;
      const room = w.rooms[w.bossRoomId];
      putInRoom(w, a, room); putInRoom(w, b, room);
      a.y += 3 * TILE; b.y += 3 * TILE; b.x += 40;
      run(w, 0.1);
      const boss = w.boss;
      const seen = new Set();
      for (let i = 0; i < 60 * 45 && !boss.dead; i++) {
        a.invuln = b.invuln = 5; a.hp = b.hp = 9;
        if (i === 60 * 15) damageEnemy(w, boss, boss.maxHp * 0.4);
        if (i === 60 * 30) damageEnemy(w, boss, boss.maxHp * 0.3);
        w.step(1 / 60, { a: { moveX: Math.sin(i / 40), moveY: Math.cos(i / 50), aim: 0, fire: true }, b: { fire: true, aim: Math.PI } });
        if (boss.lastAttack) seen.add(boss.lastAttack);
      }
      assert.ok(seen.size >= 3, `andar ${floor}: ataques vistos ${[...seen]}`);
    }
  }
});

test('Caderno Preto: jogador "assinando" não ataca; colega perto liberta', () => {
  const w = new World({ data, seed: 3, floor: 3, players: [{ id: 'a', characterId: 'harilson' }, { id: 'b', characterId: 'ana_claudia' }] });
  const [a, b] = w.players;
  a.signing = 5;
  run(w, 0.5, { a: { fire: true, aim: 0 } });
  assert.equal(w.projectiles.length, 0);
  b.x = a.x + 20; b.y = a.y;
  run(w, 1.2);
  assert.equal(a.signing, 0);
});

test('Suspensão: jogador preso fica invulnerável e volta ao lugar depois', () => {
  const w = new World({ data, seed: 3, floor: 3, players: [{ id: 'a', characterId: 'harilson' }] });
  const a = w.players[0];
  const from = { x: a.x, y: a.y };
  a.jailFrom = { ...from }; a.jailTimer = 1; a.x = 0; a.y = 0;
  assert.equal(hurtPlayer(w, a, 3), false);
  run(w, 1.2);
  assert.equal(a.jailTimer, 0);
  assert.deepEqual({ x: a.x, y: a.y }, from);
});

test('caixas quebram; barril explode e machuca inimigos por perto', async () => {
  const { createEnemy } = await import('../shared/sim/inimigos/Enemy.js');
  const w = new World({ data, seed: 9, players: [{ id: 'p1', characterId: 'harilson' }] });
  const room = w.rooms.find((r) => r.type === 'combat');
  const tx = room.cx + 2, ty = room.cy + 2;
  w.map.set(tx, ty, T.PROP);
  w.map.props.set(w.map.idx(tx, ty), { kind: 'barril', hp: 2, maxHp: 2 });
  const e = createEnemy(w, 'caderno_zumbi', (tx + 1.5) * TILE, (ty + 0.5) * TILE, room.id, { spawnTime: 0 });
  const hp = e.hp;
  damageProp(w, tx, ty, 5);
  assert.equal(w.map.get(tx, ty), T.FLOOR);
  assert.ok(e.hp < hp, 'inimigo deveria levar dano da explosão');
});

test('loja vende com moedas; estátua dá bênção uma vez', () => {
  const w = new World({ data, seed: 21, players: [{ id: 'p1', characterId: 'harilson' }] });
  const p = w.players[0];
  const apple = w.pickups.find((k) => k.kind === 'shop_item' && k.item === 'apple');
  assert.ok(apple, 'loja deveria ter maçã');
  p.hp = 2; p.coins = 3;
  interact(w, p, apple);
  assert.equal(p.coins, 3, 'sem moedas suficientes não compra');
  p.coins = 50;
  interact(w, p, apple);
  assert.equal(p.coins, 50 - apple.price);
  assert.equal(p.hp, 5);
  const statue = { kind: 'statue', blessing: 'sabedoria', price: 10, usedBy: [], x: p.x, y: p.y };
  interact(w, p, statue);
  assert.ok(Math.abs(p.mods.damageMul - 1.2) < 1e-9);
  assert.deepEqual(statue.usedBy, ['p1']);
});

test('habilidades dos professores novos funcionam', () => {
  const chars = ['filipe_stefanini', 'jean_paulo', 'vivian', 'marina'];
  const w = new World({ data, seed: 5, players: chars.map((c, i) => ({ id: 'p' + i, characterId: c })) });
  const inputs = Object.fromEntries(chars.map((c, i) => ['p' + i, { skill: true, aim: 0 }]));
  run(w, 1 / 60, inputs);
  assert.ok(w.players.every((p) => p.skillCd > 0), 'todas as habilidades deveriam entrar em recarga');
  assert.ok(w.players.every((p) => p.buffs.hasteTimer > 0), 'Pique acelera o time');
  assert.ok(w.players.every((p) => p.buffs.bubbleTimer > 0), 'Grammar Shield protege o time');
  assert.ok(w.areas.some((a) => a.kind === 'gravity'), 'Campo Gravitacional');
  assert.equal(w.allies.length, 1, 'Planta Carnívora');
});

test('os 14 professores são jogáveis com armas iniciais válidas', () => {
  const playable = data.characterList.filter((c) => c.playable);
  assert.equal(playable.length, 14);
  for (const c of playable) assert.ok(data.hasWeapon(c.starterWeapon), c.id);
  assert.ok(data.weapons.size >= 28);
});

test('Samara: se as restrições zeram todos os pesos, ainda escolhe um ataque', async () => {
  const { bossSamara } = await import('../shared/sim/inimigos/chefes/samara.js');
  const { createEnemy } = await import('../shared/sim/inimigos/Enemy.js');
  const w = new World({ data, seed: 3, floor: 3, players: [{ id: 'a', characterId: 'harilson' }] });
  const [a] = w.players;
  const boss = w.boss ?? createEnemy(w, 'samara', a.x + 200, a.y, w.bossRoomId, { spawnTime: 0 });
  createEnemy(w, 'caderno_preto', a.x + 50, a.y, w.bossRoomId, { spawnTime: 0 });
  a.jailTimer = 3;
  boss.state = 'idle'; boss.phase = 1; boss.t = 0; boss.lastAttack = 'advertencia';
  assert.doesNotThrow(() => bossSamara(w, boss, 1 / 60, a));
  assert.ok(boss.lastAttack, 'escolheu ataque');
});
