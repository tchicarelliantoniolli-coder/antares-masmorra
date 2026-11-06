import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, putInRoom, run, data } from './helpers.js';
import { RNG } from '../shared/sim/rng.js';
import { rollRunWeapon } from '../shared/sim/salas/Pickups.js';
import { damageEnemy } from '../shared/sim/combat.js';

test('rollWeapon com exclude nunca devolve arma excluída e recua quando tudo foi excluído', () => {
  const rng = new RNG(3);
  const all = data.droppableWeapons().map((w) => w.id);
  const exclude = new Set(all.slice(0, all.length - 1));
  for (let i = 0; i < 50; i++) assert.equal(data.rollWeapon(rng, null, null, exclude), all.at(-1));
  const id = data.rollWeapon(rng, null, null, new Set(all));
  assert.ok(all.includes(id), 'sem nenhuma arma livre, sorteia qualquer uma');
});

test('na mesma partida as armas sorteadas não se repetem até acabar o repertório', () => {
  const w = makeWorld();
  const pool = data.droppableWeapons().filter((x) => !w.seenWeapons.has(x.id)).length;
  const got = [];
  for (let i = 0; i < pool; i++) got.push(rollRunWeapon(w, null));
  assert.equal(new Set(got).size, pool, 'cada arma sai uma vez');
  assert.ok(data.weapon(rollRunWeapon(w, null)), 'depois de acabar, volta a sortear');
});

test('não sorteia a arma que um jogador está carregando', () => {
  const w = makeWorld();
  const p = w.players[0];
  const all = data.droppableWeapons().map((x) => x.id);
  p.weapons = [all[0], all[1]];
  for (let i = 0; i < all.length - 2; i++) assert.ok(!p.weapons.includes(rollRunWeapon(w, null)));
});

test('baús, loja e chefe da partida usam o sorteio sem repetição', () => {
  const w = makeWorld({ seed: 77 });
  const ids = w.pickups.filter((pk) => pk.kind === 'shop_item' && pk.item === 'weapon').map((pk) => pk.weaponId);
  for (const id of ids) assert.ok(w.seenWeapons.has(id), `${id} da loja marcado como visto`);
});

test('limpar sala de combate pode soltar uma arma (roomWeaponChance)', () => {
  const w = makeWorld({ seed: 5 });
  w.data = Object.create(w.data, { difficulty: { value: { ...w.data.difficulty, roomWeaponChance: 1 } } });
  const p = w.players[0];
  const room = w.rooms.find((r) => r.type === 'combat');
  putInRoom(w, p, room);
  const before = w.pickups.filter((pk) => pk.kind === 'weapon').length;
  for (let i = 0; i < 40 && room.state !== 'cleared'; i++) {
    run(w, 0.5);
    for (const e of w.enemies) if (!e.dead && e.spawning <= 0) damageEnemy(w, e, 99999, { noMul: true });
  }
  assert.equal(room.state, 'cleared');
  const after = w.pickups.filter((pk) => pk.kind === 'weapon' && !pk.dead).length;
  assert.ok(after > before, `esperava arma no chão depois de limpar (antes ${before}, depois ${after})`);
});
