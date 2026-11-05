import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoAim } from '../client/src/input/aim.js';

const mundo = (enemies) => ({ enemies, map: { lineOfSight: () => true } });

test('autoAim devolve ângulo e distância do inimigo mais perto', () => {
  const w = mundo([{ x: 300, y: 0 }, { x: 0, y: 100 }]);
  const r = autoAim(w, { x: 0, y: 0 });
  assert.ok(Math.abs(r.angle - Math.PI / 2) < 1e-9);
  assert.equal(r.dist, 100);
});

test('autoAim ignora mortos, invulneráveis e sem linha de visão; sem alvo devolve null', () => {
  const w = mundo([{ x: 50, y: 0, dead: true }, { x: 60, y: 0, def: { invulnerable: true } }, { x: 70, y: 0, spawning: 1 }, { x: 900, y: 0 }]);
  assert.equal(autoAim(w, { x: 0, y: 0 }), null);
  assert.equal(autoAim({ enemies: [{ x: 50, y: 0 }], map: { lineOfSight: () => false } }, { x: 0, y: 0 }), null);
  assert.equal(autoAim(null, { x: 0, y: 0 }), null);
});
