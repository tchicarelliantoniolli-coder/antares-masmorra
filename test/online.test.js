import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/RoomManager.js';
import { decodeSnapshot, buildMirrorMap, serializeWorld } from '../shared/net/snapshot.js';
import { arena } from './helpers.js';
import { createArea } from '../shared/sim/areas.js';
import { spawnProjectile } from '../shared/sim/armas/Projectiles.js';
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

import { sanitizeInput } from '../shared/net/InputBuffer.js';
import { DEFAULT_AIM_DIST, MAX_AIM_DIST } from '../shared/sim/constants.js';

test('aimDist vindo da rede é sanitizado', () => {
  assert.equal(sanitizeInput({ aimDist: NaN }).aimDist, DEFAULT_AIM_DIST);
  assert.equal(sanitizeInput({}).aimDist, DEFAULT_AIM_DIST, 'cliente antigo sem aimDist');
  assert.equal(sanitizeInput({ aimDist: -5 }).aimDist, 0);
  assert.equal(sanitizeInput({ aimDist: 1e9 }).aimDist, MAX_AIM_DIST);
  assert.equal(sanitizeInput({ aimDist: 'x' }).aimDist, DEFAULT_AIM_DIST);
});

import { withWeapon } from './helpers.js';

test('snapshot leva raio, carga, arremesso e mina', () => {
  const mgr = new RoomManager(data, { autoTick: false });
  const a = fakeConn();
  const r = mgr.create(a, 'Ana');
  const room = r.room;
  room.setReady(r.playerId, true);
  const w = room.world;
  const p = w.getPlayer(r.playerId);
  p.energy = p.maxEnergy = 9999;
  const tick = (n, inp) => { room.input(r.playerId, inp, 1); for (let i = 0; i < n; i++) room.tick(); return decodeSnapshot(data, a.last('game:snap')); };

  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 0 } }, p);
  let s = tick(6, { fire: true, aim: 0, aimDist: 100 });
  assert.equal(s.beams.length, 1);
  assert.equal(s.beams[0].ownerId, r.playerId);
  assert.ok(typeof s.beams[0].x2 === 'number');

  withWeapon(w, { mode: 'charge' }, p);
  s = tick(30, { fire: true, aim: 0 });
  assert.ok(s.players[0].wstate.charge > 0);
  assert.equal(s.beams.length, 0);

  withWeapon(w, { mode: 'lob', fireRate: 1, lob: { flightTime: 2 } }, p);
  tick(3, { fire: false, aim: 0 });
  s = tick(12, { fire: true, aim: 0, aimDist: 150 });
  const lobbed = s.projectiles.find((q) => q.z > 0);
  assert.ok(lobbed, 'arremesso com altura');
  assert.ok(Array.isArray(lobbed.lobTarget));

  withWeapon(w, { mode: 'deploy', fireRate: 1, deploy: { kind: 'mine' } }, p);
  tick(3, { fire: false, aim: 0 });
  s = tick(100, { fire: true, aim: 0, aimDist: 50 }); // espera a recarga do arremesso (1 s) e a mina armar
  const mine = s.allies.find((x) => x.kind === 'mine');
  assert.ok(mine);
  assert.equal(mine.ownerId, r.playerId);
  assert.equal(mine.armed, true);
});

test('estilo da poça sobrevive ao snapshot', () => {
  const { w, p } = arena();
  createArea(w, 'pool', p.x + 40, p.y, { r: 30, life: 3, dps: 1, style: 'acid' });
  const dec = decodeSnapshot(data, JSON.parse(JSON.stringify(serializeWorld(w))));
  const a = dec.areas.find((x) => x.kind === 'pool');
  assert.ok(a);
  assert.equal(a.style, 'acid');
});

test('raio do projétil sobrevive ao snapshot (globo bumerangue cresce na volta)', () => {
  const { w, p } = arena();
  const pr = spawnProjectile(w, { team: 'player', x: p.x + 40, y: p.y, angle: 0, speed: 10, damage: 1, range: 900, sprite: 'proj_globo_bumerangue', owner: p });
  pr.r = 12.5;
  const dec = decodeSnapshot(data, JSON.parse(JSON.stringify(serializeWorld(w))));
  assert.equal(dec.projectiles.find((q) => q.id === pr.id).r, 12.5);
});
