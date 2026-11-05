import test from 'node:test';
import assert from 'node:assert/strict';
import { arena, run, dummy, wallDistRight } from './helpers.js';
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

// ---------------------------------------------------------------- Task 3: inimigos novos

import { killEnemy } from '../shared/sim/combat.js';
import { spawnProjectile } from '../shared/sim/armas/Projectiles.js';

const vivos = (w, type) => w.enemies.filter((e) => e.type === type && !e.dead);

test('borracha divide 2 vezes e para', () => {
  const { w, p } = arena();
  const pai = createEnemy(w, 'borracha', p.x + 100, p.y, 7, { spawnTime: 0 });
  const r0 = pai.r, hp0 = pai.maxHp;
  const kills0 = w.stats.kills;
  killEnemy(w, pai, null);
  let filhos = vivos(w, 'borracha');
  assert.equal(filhos.length, 2);
  for (const f of filhos) {
    assert.equal(f.gen, 1);
    assert.equal(f.roomId, 7, 'filhos herdam a sala (a sala só limpa quando todos morrem)');
    assert.equal(f.maxHp, Math.round(hp0 / 2));
    assert.ok(Math.abs(f.r - r0 * 0.8) < 0.01, 'tamanho 80%');
  }
  for (const f of filhos) killEnemy(w, f, null);
  filhos = vivos(w, 'borracha');
  assert.equal(filhos.length, 4);
  assert.ok(filhos.every((f) => f.gen === 2));
  for (const f of filhos) killEnemy(w, f, null);
  assert.equal(vivos(w, 'borracha').length, 0, 'geração 2 não se divide');
  assert.equal(w.stats.kills - kills0, 7);
});

test('grampeador bate na parede e fica tonto (dano dobrado)', () => {
  const { w, p } = arena();
  p.invuln = 99;
  p.x += wallDistRight(w, p) - 250; // perto da parede direita: a investida bate nela
  const e = createEnemy(w, 'grampeador', p.x - 150, p.y, -1, { spawnTime: 0 });
  e.cd = 0;
  let aviso = false, tempoAviso = 0;
  for (let i = 0; i < 60 * 6 && e.state !== 'stunned'; i++) {
    w.step(1 / 60, {});
    if (e.state === 'windup' && e.telegraph?.type === 'line') { aviso = true; tempoAviso += 1 / 60; }
  }
  assert.ok(aviso && tempoAviso >= 0.7, 'aviso line de ~0,8 s antes da investida: ' + tempoAviso);
  assert.equal(e.state, 'stunned');
  assert.equal(e.telegraph, null);
  const hp = e.hp;
  assert.equal(damageEnemy(w, e, 3, {}), 6, 'tonto leva dano dobrado');
  assert.equal(e.hp, hp - 6);
  run(w, 1.4);
  assert.notEqual(e.state, 'stunned', 'tontura dura ~1,2 s');
});

test('régua: aviso antes do tiro e tiro de dano 2', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const e = createEnemy(w, 'regua_mira', p.x + 330, p.y, -1, { spawnTime: 0 });
  e.cd = 0;
  let tAviso = -1, tTiro = -1, bala = null;
  for (let i = 0; i < 60 * 4 && tTiro < 0; i++) {
    w.step(1 / 60, {});
    if (tAviso < 0 && e.telegraph?.type === 'line') tAviso = w.time;
    const b = inimigosHostis(w)[0];
    if (b) { tTiro = w.time; bala = b; }
  }
  assert.ok(tAviso >= 0 && tTiro > tAviso + 0.8, 'aviso ~1 s antes do tiro: ' + (tTiro - tAviso));
  assert.equal(bala.damage, 2);
  assert.equal(Math.round(Math.hypot(bala.vx, bala.vy)), 650);
  assert.ok(e.telegraph == null, 'aviso some depois do tiro');
});

test('apontador: enterrado não leva dano nem empurra; emerge sob o jogador depois do aviso', () => {
  const { w, p } = arena();
  const e = createEnemy(w, 'apontador', p.x + 200, p.y, -1, { spawnTime: 0 });
  e.cd = 0;
  let enterrou = false;
  for (let i = 0; i < 20 && !enterrou; i++) { w.step(1 / 60, {}); enterrou = e.burrowed; }
  assert.ok(enterrou, 'enterra');
  const hp = e.hp;
  assert.equal(damageEnemy(w, e, 5, { knockback: 300, angle: 0 }), 0);
  assert.equal(e.hp, hp);
  assert.equal(e.kx, 0);
  // projétil do jogador atravessa o enterrado e acerta quem está atrás
  const atras = dummy(w, e.x + 40, e.y, 50);
  spawnProjectile(w, { team: 'player', x: e.x - 30, y: e.y, angle: 0, speed: 300, radius: 4, damage: 3, owner: p, sprite: 'px' });
  for (let i = 0; i < 30; i++) w.step(1 / 60, {});
  assert.ok(atras.hp < 50, 'projétil passou pelo enterrado');
  // segue o jogador por baixo, avisa e emerge
  p.invuln = 0; p.shield = 0;
  const hp0 = p.hp;
  let circulo = null, emergiu = false;
  for (let i = 0; i < 60 * 8 && !emergiu; i++) {
    w.step(1 / 60, {});
    if (e.telegraph?.type === 'circle' && !circulo) circulo = { ...e.telegraph, burrowed: e.burrowed };
    emergiu = !e.burrowed && e.state === 'exposed';
  }
  assert.ok(circulo && circulo.burrowed, 'aviso circle enquanto enterrado');
  assert.ok(emergiu, 'emerge');
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) < 20, 'emerge sob o jogador');
  assert.equal(p.hp, hp0 - 2, 'dano 2 em quem está no círculo');
  assert.ok(damageEnemy(w, e, 1, {}) > 0, 'exposto leva dano');
});

test('monitor: invoca no máximo 6 e os invocados não dão drop', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const m = createEnemy(w, 'monitor', p.x + 250, p.y, 3, { spawnTime: 0 });
  m.cd = 0;
  let aviso = false;
  for (let i = 0; i < 60 * 30; i++) {
    w.step(1 / 60, {});
    if (m.telegraph) aviso = true;
    for (const z of vivos(w, 'caderno_zumbi')) { z.hp = z.maxHp = 9999; z.def = { ...z.def, behavior: 'none', contactDamage: 0 }; }
  }
  const zs = vivos(w, 'caderno_zumbi');
  assert.ok(aviso, 'brilho de aviso antes de invocar');
  assert.equal(zs.length, 6, 'máximo de 6 vivos');
  assert.ok(zs.every((z) => z.minion && z.roomId === 3));
  const moedas = w.pickups.length;
  killEnemy(w, zs[0], null);
  assert.equal(w.pickups.length, moedas, 'invocado não dropa');
});

test('grêmio: dá escudo a um inimigo e foge', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const g = createEnemy(w, 'gremio', p.x + 150, p.y, -1, { spawnTime: 0 });
  g.cd = 0;
  const aliado = dummy(w, g.x + 60, g.y, 40);
  const d0 = Math.hypot(g.x - p.x, g.y - p.y);
  run(w, 0.2);
  assert.equal(aliado.shielded, 1);
  assert.equal(g.healTarget, aliado.id, 'linha visível para o aliado');
  assert.equal(damageEnemy(w, aliado, 5, {}), 0, 'primeiro golpe é absorvido');
  assert.ok(!aliado.shielded, 'escudo some depois do golpe');
  assert.ok(damageEnemy(w, aliado, 5, {}) > 0);
  run(w, 1);
  assert.ok(Math.hypot(g.x - p.x, g.y - p.y) > d0 + 20, 'foge do jogador');
});

test('grêmio: cura 20% de aliado ferido', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const g = createEnemy(w, 'gremio', p.x + 150, p.y, -1, { spawnTime: 0 });
  g.cd = 0;
  const aliado = dummy(w, g.x + 60, g.y, 100);
  aliado.hp = 40;
  run(w, 0.2);
  assert.equal(aliado.hp, 60);
  assert.ok(!aliado.shielded);
});

test('chamada: aviso e teleporte para perto do jogador, depois rajada de 5', () => {
  const { w, p } = arena();
  p.invuln = 99;
  const e = createEnemy(w, 'chamada', p.x + 300, p.y + 100, -1, { spawnTime: 0 });
  e.cd = 0;
  let aviso = null, pos = null, balas = 0;
  const vistos = new Set();
  for (let i = 0; i < 60 * 6 && !(pos && balas >= 5); i++) {
    w.step(1 / 60, {});
    if (!aviso && e.telegraph?.type === 'circle') aviso = { ...e.telegraph, t: w.time, longe: Math.hypot(e.x - p.x, e.y - p.y) };
    if (aviso && !pos && !e.burrowed) pos = { x: e.x, y: e.y, t: w.time };
    for (const b of inimigosHostis(w)) if (!vistos.has(b.id)) { vistos.add(b.id); balas++; }
  }
  assert.ok(aviso, 'aviso circle');
  const d = Math.hypot(aviso.x - p.x, aviso.y - p.y);
  assert.ok(d >= 85 && d <= 145, 'ponto a 90–140 px do jogador: ' + d);
  assert.ok(pos && pos.t - aviso.t >= 0.55, 'teleporta só depois do aviso (0,6 s)');
  assert.ok(Math.hypot(pos.x - aviso.x, pos.y - aviso.y) < 1);
  assert.equal(balas, 5);
  run(w, 1);
  assert.ok(e.burrowed, 'some de novo');
});

test('inimigo enterrado ou teleportando quando o andar troca não dá erro', () => {
  const { w, p } = arena();
  const a = createEnemy(w, 'apontador', p.x + 100, p.y, -1, { spawnTime: 0 });
  const c = createEnemy(w, 'chamada', p.x - 100, p.y, -1, { spawnTime: 0 });
  a.cd = 0; c.cd = 0;
  for (let i = 0; i < 80; i++) w.step(1 / 60, {});
  a.burrowed = true; a.state = 'warn'; c.state = 'warn'; c.burrowed = true;
  assert.doesNotThrow(() => { w.completeFloor(); run(w, 1); });
  assert.equal(w.floorNum, 2);
});

test('monitor morto leva os invocados junto e a sala limpa', () => {
  const { w, p, room } = arena();
  p.invuln = 99;
  room.state = 'active'; room.waves = [['monitor']]; room.waveIndex = 0;
  w.activeRoom = room; w.map.locked.add(room.id);
  const m = createEnemy(w, 'monitor', p.x + 250, p.y, room.id, { spawnTime: 0 });
  m.cd = 0;
  for (let i = 0; i < 60 * 3 && vivos(w, 'caderno_zumbi').length < 2; i++) w.step(1 / 60, {});
  assert.ok(vivos(w, 'caderno_zumbi').length >= 2, 'monitor invocou');
  killEnemy(w, m, null);
  run(w, 1);
  assert.equal(vivos(w, 'caderno_zumbi').length, 0, 'invocados somem com o monitor');
  assert.equal(room.state, 'cleared');
  assert.ok(!w.map.locked.has(room.id), 'portas destravadas');
  assert.equal(w.enemies.filter((e) => e.roomId === room.id && !e.dead).length, 0);
});
