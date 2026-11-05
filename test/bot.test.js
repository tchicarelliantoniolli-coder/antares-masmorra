import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../shared/sim/World.js';
import { data } from './helpers.js';
import { PROFILES, runMatch } from '../scripts/bot/bot.mjs';

// roomCount 2 não gera andar (o gerador exige >= 3 salas de combate + 3 especiais + entrada + chefe): 6 é o mínimo.
test('bot termina um andar curto sem travar', () => {
  const t0 = Date.now();
  const profile = { ...PROFILES.experiente, useSkill: true };
  const r = runMatch({ World, data, seed: 7, players: 1, profile, maxSeconds: 240, worldOpts: { roomCount: 6, maxFloors: 1 } });
  assert.ok(['victory', 'defeat'].includes(r.reason), `reason inesperado: ${JSON.stringify(r)}`);
  assert.ok(Date.now() - t0 < 20000, 'demorou demais');
});

test('perfis têm os campos esperados', () => {
  for (const p of Object.values(PROFILES)) {
    for (const k of ['reaction', 'aimError', 'dodge', 'keepRange', 'useSkill']) assert.ok(k in p, k);
  }
});
