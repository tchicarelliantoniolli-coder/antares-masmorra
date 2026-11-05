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

test('todos os 14 professores têm arma inicial existente e grátis', () => {
  assert.equal(data.characterList.length, 14);
  for (const c of data.characterList) {
    assert.ok(data.hasWeapon(c.starterWeapon), `${c.id}: ${c.starterWeapon}`);
    const w = data.weapon(c.starterWeapon);
    assert.equal(w.energyCost, 0, c.starterWeapon);
    assert.ok(w.starterOnly, c.starterWeapon);
  }
});

test('há pelo menos 45 armas e pelo menos 12 modos/estilos diferentes em uso', () => {
  const all = [...data.weapons.values()].filter((w) => !w.id.startsWith('t_'));
  assert.ok(all.length >= 45, `${all.length} armas`);
  const used = new Set(all.map((w) => (w.type === 'melee' ? 'melee:' + w.melee.style : w.mode)));
  assert.ok(used.size >= 12, [...used].join(', '));
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

// ---------------------------------------------------------------- modos de arma (v0.3)
import { normalizeWeapon, WEAPON_MODES, MELEE_STYLES, MODE_LABELS } from '../shared/sim/data.js';

const base = { id: 't', name: 'T', category: 'fogo', rarity: 'comum', damage: 1, fireRate: 1, energyCost: 0, critChance: 0, inaccuracy: 0 };

test('arma sem mode vira "shot"; melee sem estilo vira "swing"', () => {
  assert.equal(normalizeWeapon({ ...base, type: 'ranged' }).mode, 'shot');
  assert.equal(normalizeWeapon({ ...base, type: 'melee' }).melee.style, 'swing');
});

test('bloco do modo é mesclado com os padrões', () => {
  const w = normalizeWeapon({ ...base, type: 'ranged', mode: 'beam', beam: { dps: 30 } });
  assert.equal(w.beam.dps, 30);
  assert.equal(w.beam.tick, 0.1);
  const m = normalizeWeapon({ ...base, type: 'melee', melee: { style: 'combo', combo: { finisherMul: 3 } } });
  assert.equal(m.melee.combo.finisherMul, 3);
  assert.equal(m.melee.combo.steps, 3);
  const v = normalizeWeapon({ ...base, type: 'ranged', mode: 'variants', variants: { list: [{ speed: 300 }] } });
  assert.equal(v.variants.list[0].speed, 300);
  assert.equal(v.variants.list[0].radius, 5, 'variante vira projétil completo');
});

test('validador acusa modo, estilo, sorteio vazio, tipo de deploy e campo com erro de digitação', () => {
  const json = readJson('weapons.json');
  const check = (w) => validateWeapons({ ...json, weapons: [{ ...base, ...w }] });
  assert.ok(check({ type: 'ranged', mode: 'laserzao' }).some((e) => e.includes('modo desconhecido')));
  assert.ok(check({ type: 'melee', melee: { style: 'voadora' } }).some((e) => e.includes('estilo de corpo a corpo desconhecido')));
  assert.ok(check({ type: 'ranged', mode: 'variants', variants: { list: [] } }).some((e) => e.includes('variants')));
  assert.ok(check({ type: 'ranged', mode: 'deploy', deploy: { kind: 'canhao' } }).some((e) => e.includes('deploy')));
  assert.ok(check({ type: 'ranged', mode: 'charge', charge: { tiem: 1 } }).some((e) => e.includes('campo desconhecido "tiem"')));
  assert.deepEqual(check({ type: 'ranged', mode: 'charge', charge: { time: 1 } }), []);
});

test('todo modo e estilo tem nome em português', () => {
  for (const m of [...WEAPON_MODES, ...MELEE_STYLES]) assert.ok(MODE_LABELS[m], m);
  assert.equal(WEAPON_MODES.length, 14);
  assert.deepEqual(MELEE_STYLES, ['swing', 'thrust', 'combo', 'shield']);
});

test('validador exige deploy.max inteiro >= 1', () => {
  const json = readJson('weapons.json');
  const check = (w) => validateWeapons({ ...json, weapons: [{ ...base, ...w }] });
  for (const max of [0, -1, 1.5]) {
    assert.ok(check({ type: 'ranged', mode: 'deploy', deploy: { max } }).some((e) => e.endsWith('deploy.max deve ser pelo menos 1')), `max ${max}`);
  }
  assert.deepEqual(check({ type: 'ranged', mode: 'deploy', deploy: { max: 1 } }), []);
  assert.deepEqual(check({ type: 'ranged', mode: 'deploy' }), []);
});
