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

const { Controller, KeyTracker } = await import('../client/src/input/Controllers.js');
function controller(device = 'auto') {
  const pressed = new Set(), down = new Set();
  const keys = { wasPressed: code => pressed.has(code), isDown: code => down.has(code) };
  const pointer = { x: 100, y: -4, leftButtonDown: () => false, rightButtonDown: () => false };
  const scene = { input: { on() {}, activePointer: pointer }, cameras: { main: { getWorldPoint: (x, y) => ({ x, y }) } } };
  return { ctrl: new Controller(scene, keys, device), pressed, down };
}
test('Enter liga tiro persistente, mantém movimento e mira, e desliga no próximo toque', () => {
  const { ctrl, pressed, down } = controller();
  const p = { x: 0, y: 0 };
  assert.equal(ctrl.poll(null, p).fire, false);
  pressed.add('Enter');
  assert.equal(ctrl.poll(null, p).fire, true);
  pressed.clear(); down.add('KeyD');
  const input = ctrl.poll(null, p);
  assert.equal(input.fire, true); assert.equal(input.moveX, 1); assert.equal(input.aim, 0);
  pressed.add('NumpadEnter');
  assert.equal(ctrl.poll(null, p).fire, false);
});
test('Enter do segundo teclado continua atirando somente enquanto pressionado', () => {
  const { ctrl, pressed, down } = controller('kb2');
  pressed.add('Enter'); down.add('Enter');
  assert.equal(ctrl.poll(null, null).fire, true);
  pressed.clear(); down.clear();
  assert.equal(ctrl.poll(null, null).fire, false);
  assert.equal(ctrl.autoFire, false);
});
test('segurar Enter não repete a alternância e perder foco limpa teclas pendentes', () => {
  const previous = globalThis.window;
  globalThis.window = new EventTarget();
  try {
    const k = new KeyTracker();
    const press = () => { const e = new Event('keydown', { cancelable: true }); Object.assign(e, { code: 'Enter' }); window.dispatchEvent(e); return e; };
    assert.equal(press().defaultPrevented, true);
    assert.equal(k.wasPressed('Enter'), true);
    k.endFrame(); press();
    assert.equal(k.wasPressed('Enter'), false);
    window.dispatchEvent(new Event('blur'));
    assert.equal(k.isDown('Enter'), false); assert.equal(k.wasPressed('Enter'), false);
    k.destroy();
  } finally { globalThis.window = previous; }
});
