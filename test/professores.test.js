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

// ---------------------------------------------------------------- controle (Andréia, Vinícius, William, Gabriela P.)
import { World } from '../shared/sim/World.js';
import { data } from './helpers.js';
import { aimPoint } from '../shared/sim/armas/modes/ground.js';
import { damageEnemy } from '../shared/sim/combat.js';
import { createArea } from '../shared/sim/areas.js';

function arenaDe(characterId) {
  const w = new World({ data, seed: 1234, players: [{ id: 'p1', characterId }] });
  const p = w.players[0];
  const room = w.rooms.find((r) => r.type === 'combat');
  putInRoom(w, p, room);
  for (let ty = room.y0; ty < room.y0 + room.h; ty++) for (let tx = room.x0; tx < room.x0 + room.w; tx++) {
    const t = w.map.get(tx, ty);
    if (t === 2 || t === 3) { w.map.set(tx, ty, 1); w.map.props.delete(w.map.idx(tx, ty)); }
  }
  room.state = 'cleared';
  p.roomId = room.id;
  p.energy = p.maxEnergy = 9999;
  return { w, p, room };
}

test('Translate: inimigo confuso atira em outro inimigo e não no jogador', () => {
  const { w, p } = arenaDe('andreia');
  const atirador = createEnemy(w, 'prova_voadora', p.x + 120, p.y, -1, { spawnTime: 0 });
  atirador.cd = 0;
  const alvo = dummy(w, p.x + 120, p.y + 90, 500);
  assert.ok(SKILLS.translate(w, p));
  assert.ok(atirador.status.confused > 0);
  assert.equal(nearestTarget(w, atirador), alvo);
  const hp = p.hp;
  run(w, 3);
  assert.ok(alvo.hp < 500, 'o alvo levou tiro');
  assert.equal(p.hp, hp, 'o jogador não foi ferido');
});

test('Translate: contato de confuso fere inimigos e não jogadores; chefe só fica lento', () => {
  const { w, p } = arenaDe('andreia');
  const zumbi = createEnemy(w, 'caderno_zumbi', p.x + 20, p.y, -1, { spawnTime: 0 });
  const alvo = dummy(w, p.x + 40, p.y, 500);
  const boss = dummy(w, p.x, p.y + 100, 500);
  boss.def = { ...boss.def, boss: true };
  SKILLS.translate(w, p);
  assert.ok(!(boss.status.confused > 0));
  assert.ok(boss.status.slow > 0);
  const hp = p.hp;
  run(w, 1);
  assert.equal(p.hp, hp);
  assert.ok(alvo.hp < 500, 'contato machucou o outro inimigo');
});

test('Translate sem inimigos perto não dá erro e entra em recarga', () => {
  const { w, p } = arenaDe('andreia');
  assert.doesNotThrow(() => run(w, 0.1, { p1: { skill: true } }));
  assert.ok(p.skillCd > 5);
});

test('Circuito: dano em um repassa metade aos ligados', () => {
  const { w, p } = arenaDe('vinicius');
  const a = dummy(w, p.x + 80, p.y, 100), b = dummy(w, p.x + 80, p.y + 60, 100), c = dummy(w, p.x + 80, p.y - 60, 100);
  const longe = dummy(w, p.x + 500, p.y, 100);
  assert.ok(SKILLS.circuito(w, p));
  assert.equal(a.linked.id, b.linked.id);
  assert.ok(!longe.linked);
  damageEnemy(w, a, 20, { noMul: true });
  assert.equal(a.hp, 80);
  assert.equal(b.hp, 90);
  assert.equal(c.hp, 90);
  assert.equal(longe.hp, 100);
  damageEnemy(w, b, 10, { noMul: true, noChain: true });
  assert.equal(a.hp, 80, 'dano secundário não recircula');
  run(w, 6.5);
  damageEnemy(w, a, 10, { noMul: true });
  assert.equal(b.hp, 80, 'circuito expirou');
});

test('Terremoto atordoa e o próximo uso é Vulcão', () => {
  const { w, p } = arenaDe('william');
  const e = dummy(w, p.x + 100, p.y, 100);
  e.roomId = p.roomId;
  const fora = dummy(w, p.x + 100, p.y + 40, 100);
  fora.roomId = -99;
  assert.equal(p.buffs.quakeNext, 'terremoto');
  assert.ok(SKILLS.terremoto(w, p));
  assert.equal(e.status.stun, 1.5);
  assert.equal(e.hp, 92);
  assert.equal(fora.hp, 100);
  assert.equal(p.buffs.quakeNext, 'vulcao');
  assert.ok(w.events.some((ev) => ev.type === 'quake'));
  p.aim = 0; p.aimDist = 150;
  assert.ok(SKILLS.terremoto(w, p));
  assert.ok(w.areas.some((a) => a.kind === 'volcano'));
  assert.equal(p.buffs.quakeNext, 'terremoto');
  const alvo = dummy(w, p.x + 150, p.y, 1000);
  alvo.roomId = -99;
  run(w, 4.5);
  assert.ok(alvo.hp < 1000, 'lava machucou');
  assert.ok(!w.areas.some((a) => a.kind === 'volcano' && !a.dead));
});

test('Vulcão mirando parede cai antes da parede', () => {
  const { w, p } = arenaDe('william');
  p.buffs.quakeNext = 'vulcao';
  p.aim = 0; p.aimDist = 260;
  const ponto = aimPoint(w, p, 260);
  SKILLS.terremoto(w, p);
  const v = w.areas.find((a) => a.kind === 'volcano');
  assert.ok(v);
  assert.ok(Math.abs(v.x - ponto.x) < 1 && !w.map.solidAt(v.x, v.y));
  // jogador colado numa parede: mira nela e a área não entra na parede
  p.aim = Math.PI; p.aimDist = 260;
  while (!w.map.solidAt(p.x - 20, p.y)) p.x -= 4;
  p.buffs.quakeNext = 'vulcao';
  SKILLS.terremoto(w, p);
  const v2 = w.areas.filter((a) => a.kind === 'volcano')[1];
  assert.ok(!w.map.solidAt(v2.x, v2.y));
  assert.ok(v2.x >= p.x - 30);
});

test('Obra-Prima deixa inimigos muito lentos', () => {
  const { w, p } = arenaDe('gabriela_pyles');
  p.aim = 0; p.aimDist = 100;
  const e = dummy(w, p.x + 100, p.y - 30, 100);
  const fora = dummy(w, p.x + 100, p.y + 250, 100);
  assert.ok(SKILLS.obra_prima(w, p));
  const a = w.areas.find((x) => x.kind === 'painting');
  assert.equal(a.r, 140);
  run(w, 0.1);
  assert.ok(e.status.slow > 0 && e.status.slowMul <= 0.3);
  assert.ok(!(fora.status.slow > 0));
});

test('Paleta Viva: poça da Gabriela P. tem efeito', () => {
  const { w, p } = arenaDe('gabriela_pyles');
  assert.ok(p.mods.paletaViva);
  const tipos = new Set();
  for (let i = 0; i < 30; i++) tipos.add(createArea(w, 'pool', p.x, p.y, { ownerId: p.id, r: 40, life: 3, dps: 2, effect: null, slowMul: 1, style: 'paint' }).effect.type);
  for (const t of tipos) assert.ok(['fogo', 'gelo', 'veneno'].includes(t), String(t));
  assert.ok(tipos.size > 1, 'sorteio varia');
  const outro = arenaDe('harilson');
  assert.equal(createArea(outro.w, 'pool', 0, 0, { ownerId: 'p1', effect: null }).effect, null);
});
