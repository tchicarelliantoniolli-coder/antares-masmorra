import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWeapons } from '../shared/sim/data.js';
import { readJson } from '../shared/sim/loadDataNode.js';
import { data } from './helpers.js';
import { RNG } from '../shared/sim/rng.js';

test('weapons.json é válido e tem pelo menos 10 armas', () => {
  const json = readJson('weapons.json');
  assert.deepEqual(validateWeapons(json), []);
  assert.ok(json.weapons.length >= 10);
});

test('validador acusa erros comuns', () => {
  const json = readJson('weapons.json');
  const bad = { ...json, weapons: [{ id: 'x', name: 'X', category: 'nada', rarity: 'mítica', type: 'laser', damage: -1, fireRate: 0, energyCost: 0, critChance: 0, inaccuracy: 0 }] };
  const errs = validateWeapons(bad);
  assert.ok(errs.some((e) => e.includes('raridade')));
  assert.ok(errs.some((e) => e.includes('categoria')));
  assert.ok(errs.some((e) => e.includes('type')));
  assert.ok(errs.some((e) => e.includes('damage')));
});

test('personagens jogáveis têm arma inicial existente; são 14 professores', () => {
  assert.equal(data.characterList.length, 14);
  const playable = data.characterList.filter((c) => c.playable);
  assert.ok(playable.length >= 2);
  for (const c of playable) assert.ok(data.hasWeapon(c.starterWeapon), c.id);
});

test('sorteio de arma respeita raridade mínima e nunca dá arma inicial', () => {
  const rng = new RNG(5);
  for (let i = 0; i < 500; i++) {
    const id = data.rollWeapon(rng, null, 'rara');
    const w = data.weapon(id);
    assert.ok(!w.starterOnly);
    assert.ok(data.rarities[w.rarity].order >= 2, `${id} é ${w.rarity}`);
  }
});

test('o exemplo de arma do docs/ARMAS.md é válido', async () => {
  const { readFileSync } = await import('node:fs');
  const md = readFileSync(new URL('../docs/ARMAS.md', import.meta.url), 'utf8');
  const block = md.split('## Exemplo completo')[1].split('```json')[1].split('```')[0];
  const example = JSON.parse(block);
  const json = readJson('weapons.json');
  assert.deepEqual(validateWeapons({ ...json, weapons: [...json.weapons, example] }), []);
});
