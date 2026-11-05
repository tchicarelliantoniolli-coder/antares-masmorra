import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/RoomManager.js';
import { decodeSnapshot, buildMirrorMap } from '../shared/net/snapshot.js';
import { data } from './helpers.js';

function fakeConn() {
  const msgs = [];
  return { msgs, send: (ev, payload) => msgs.push([ev, JSON.parse(JSON.stringify(payload))]), last: (ev) => [...msgs].reverse().find((m) => m[0] === ev)?.[1] };
}

test('sala online: criar, entrar com código, professor único, prontos = começa', () => {
  const mgr = new RoomManager(data, { autoTick: false });
  const a = fakeConn(), b = fakeConn();
  const r1 = mgr.create(a, 'Ana');
  assert.ok(r1.ok);
  assert.match(r1.code, /^[A-Z]{4}$/);
  const r2 = mgr.join(r1.code.toLowerCase(), b, 'Beto');
  assert.ok(r2.ok, r2.error);
  const room = r1.room;
  assert.notEqual(room.get(r1.playerId).characterId, room.get(r2.playerId).characterId, 'cada um começa com um professor diferente');
  // não pode pegar o professor do outro
  const taken = room.get(r1.playerId).characterId;
  assert.equal(room.setCharacter(r2.playerId, taken).ok, false);
  assert.equal(room.setCharacter(r2.playerId, 'andreia').ok, false, 'bloqueado');
  assert.equal(room.setCharacter(r2.playerId, 'vivian').ok, true);
  assert.equal(mgr.join('ZZZZ', fakeConn(), 'x').ok, false);
  room.setReady(r1.playerId, true);
  assert.equal(room.state, 'lobby');
  room.setReady(r2.playerId, true);
  assert.equal(room.state, 'playing');
  const start = b.last('game:start');
  assert.equal(start.youId, r2.playerId);
  assert.ok(start.map.tiles.length > 1000);
  // simula e confere o snapshot
  room.input(r1.playerId, { moveX: 1, moveY: 0, aim: 0, fire: true }, 7);
  for (let i = 0; i < 30; i++) room.tick();
  const snap = a.last('game:snap');
  assert.equal(snap.players.length, 2);
  assert.equal(snap.players.find((p) => p.id === r1.playerId).ack, 7);
  const mirror = buildMirrorMap(data, start);
  assert.equal(mirror.rooms.length, mgr.rooms.get(r1.code).world.rooms.length);
  const dec = decodeSnapshot(data, snap);
  assert.ok(Array.isArray(dec.projectiles));
  // quem sai no meio da partida vira "caído" e a sala continua
  room.remove(r2.playerId);
  assert.equal(room.players.length, 1);
  assert.ok(room.world.getPlayer(r2.playerId).dead);
  room.remove(r1.playerId);
  assert.equal(mgr.rooms.size, 0, 'sala vazia é apagada');
});

test('sala cheia com 4 jogadores e fim de jogo volta para o lobby', () => {
  const mgr = new RoomManager(data, { autoTick: false });
  const conns = [fakeConn(), fakeConn(), fakeConn(), fakeConn(), fakeConn()];
  const r = mgr.create(conns[0], 'A');
  for (let i = 1; i < 4; i++) assert.ok(mgr.join(r.code, conns[i], 'J' + i).ok);
  assert.equal(mgr.join(r.code, conns[4], 'X').ok, false);
  const room = r.room;
  const chars = room.players.map((p) => p.characterId);
  assert.equal(new Set(chars).size, 4, 'professores diferentes');
  for (const p of room.players) room.setReady(p.id, true);
  assert.equal(room.state, 'playing');
  for (const p of room.world.players) { p.shield = 0; p.hp = 0; p.downed = true; }
  for (let i = 0; i < 60 * 4; i++) room.tick();
  assert.equal(room.state, 'lobby');
  const end = conns[0].last('game:end');
  assert.equal(end.victory, false);
});
