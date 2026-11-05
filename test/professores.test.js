import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arena, dummy, run, makeWorld, putInRoom } from './helpers.js';
import { SKILLS } from '../shared/sim/personagens/skills.js';
import { createEnemy, nearestTarget } from '../shared/sim/inimigos/Enemy.js';
import { createAlly } from '../shared/sim/personagens/Allies.js';
import { spawnProjectile } from '../shared/sim/armas/Projectiles.js';
import { hurtAlly } from '../shared/sim/combat.js';
import { serializeWorld, decodeSnapshot } from '../shared/net/snapshot.js';

test('inimigo mira no aliado com taunt mais perto', () => {
  const { w, p } = arena();
  const e = dummy(w, p.x + 200, p.y);
  const perto = createAlly(w, 'planta', p.x + 150, p.y, { ownerId: p.id, hp: 15, taunt: true });
  assert.equal(nearestTarget(w, e), perto);
  const mudo = createAlly(w, 'planta', e.x - 10, e.y, { ownerId: p.id, hp: 15, taunt: false });
  assert.equal(nearestTarget(w, e), perto, 'sem taunt não atrai');
  mudo.dead = true;
  perto.hp = 0;
  assert.equal(nearestTarget(w, e), p, 'aliado sem vida não atrai');
});

test('bala inimiga e contato tiram vida do aliado; aliado morre com hp 0', () => {
  const { w, p } = arena();
  const a = createAlly(w, 'planta', p.x + 120, p.y, { ownerId: p.id, hp: 15, taunt: true, life: 99 });
  assert.equal(a.maxHp, 15);
  spawnProjectile(w, { team: 'enemy', x: a.x - 60, y: a.y, angle: 0, speed: 300, radius: 5, damage: 4, range: 200, sprite: 'proj_semente' });
  run(w, 0.5);
  assert.equal(a.hp, 11);
  const hpP = p.hp;
  const e = createEnemy(w, 'caderno_zumbi', a.x + 8, a.y, -1, { spawnTime: 0 });
  e.def = { ...e.def, behavior: 'none', contactDamage: 5 };
  run(w, 0.1);
  assert.equal(a.hp, 6);
  assert.equal(p.hp, hpP);
  hurtAlly(w, a, 99);
  assert.ok(a.dead);
  assert.ok(w.events.some((ev) => ev.type === 'ally_end'));
});

test('cada tipo novo causa dano num dummy em 3 s e nunca no jogador', () => {
  const kinds = { legionario: 30, cavaleiro: 22, bandeirante: 16, capitu: 16, macunaima: 18, policarpo: 26 };
  for (const [kind, hp] of Object.entries(kinds)) {
    const { w, p } = arena();
    const d = dummy(w, p.x + 140, p.y, 500);
    const a = createAlly(w, kind, p.x + 60, p.y, { ownerId: p.id, life: 30 });
    assert.equal(a.hp, hp, kind + ' hp');
    assert.equal(a.taunt, true, kind + ' taunt');
    const hpP = p.hp;
    run(w, 3);
    assert.ok(d.hp < 500, kind + ' deveria ferir o dummy');
    assert.equal(p.hp, hpP, kind + ' não fere jogador');
    if (kind === 'capitu') assert.ok(d.status.slow > 0 || d.hp < 500);
  }
});

test('capitu deixa o inimigo lento', () => {
  const { w, p } = arena();
  const d = dummy(w, p.x + 140, p.y, 500);
  createAlly(w, 'capitu', p.x + 60, p.y, { ownerId: p.id, life: 30 });
  let slowed = false;
  for (let i = 0; i < 120; i++) { w.step(1 / 60, {}); if (d.status.slow > 0) slowed = true; }
  assert.ok(slowed);
});

test('aliado some quando o dono sai da partida', () => {
  const { w, p } = arena();
  const a = createAlly(w, 'legionario', p.x + 60, p.y, { ownerId: p.id, life: 30 });
  run(w, 0.1);
  assert.ok(!a.dead);
  p.dead = true;
  run(w, 0.1);
  assert.ok(a.dead);
});

test('snapshot leva hp e maxHp do aliado', () => {
  const { w, p } = arena();
  createAlly(w, 'policarpo', p.x + 60, p.y, { ownerId: p.id, life: 30 });
  const s = decodeSnapshot(w.data, JSON.parse(JSON.stringify(serializeWorld(w))));
  assert.equal(s.allies[0].hp, 26);
  assert.equal(s.allies[0].maxHp, 26);
});

// ---------------------------------------------------------------- invocações (Felipe e Tatiane)
function arenaCom(characterId) {
  const w = makeWorld({ players: [{ id: 'p1', characterId }] });
  const p = w.players[0];
  const room = w.rooms.find((r) => r.type === 'combat');
  putInRoom(w, p, room);
  room.state = 'cleared';
  p.energy = p.maxEnergy = 9999;
  return { w, p };
}
const vivos = (w, kind) => w.allies.filter((a) => !a.dead && a.kind === kind);

test('Exército Histórico invoca 3 soldados que duram 15 s com o Felipe', () => {
  const { w, p } = arenaCom('felipe_cardoso');
  assert.equal(p.mods.allyLifeMul, 1.5);
  assert.ok(SKILLS.exercito_historico(w, p));
  const sol = w.allies.filter((a) => a.ownerId === p.id);
  assert.deepEqual(sol.map((a) => a.kind).sort(), ['bandeirante', 'cavaleiro', 'legionario']);
  for (const a of sol) assert.equal(a.life, 15);
  assert.ok(w.events.some((ev) => ev.type === 'skill' && ev.skill === 'exercito_historico'));
  run(w, 14);
  assert.equal(sol.filter((a) => !a.dead).length, 3);
  run(w, 1.2);
  assert.equal(sol.filter((a) => !a.dead).length, 0);
});

test('Clássicos Vivos invoca Capitu, Macunaíma e Policarpo por 10 s', () => {
  const { w, p } = arenaCom('tatiane');
  assert.equal(p.mods.allyLifeMul, 1);
  assert.ok(SKILLS.classicos_vivos(w, p));
  const cl = w.allies.filter((a) => a.ownerId === p.id);
  assert.deepEqual(cl.map((a) => a.kind).sort(), ['capitu', 'macunaima', 'policarpo']);
  for (const a of cl) assert.equal(a.life, 10);
  assert.ok(w.events.some((ev) => ev.type === 'skill' && ev.skill === 'classicos_vivos'));
});

test('Planta da Vivian também usa allyLifeMul', () => {
  const { w, p } = arenaCom('vivian');
  p.mods.allyLifeMul = 2;
  SKILLS.planta_carnivora(w, p);
  assert.equal(vivos(w, 'planta')[0].life, 24);
});

test('invocações do Felipe atacam inimigos', () => {
  const { w, p } = arenaCom('felipe_cardoso');
  const d = dummy(w, p.x + 150, p.y, 500);
  SKILLS.exercito_historico(w, p);
  run(w, 4);
  assert.ok(d.hp < 500);
});
