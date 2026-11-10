import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TouchControls, stickVector } from '../client/src/input/TouchControls.js';

class Element extends EventTarget {
  children = [];
  captured = new Set();
  style = {};
  append(...children) { this.children.push(...children); }
  set innerHTML(value) { this.firstChild = new Element(); }
  setAttribute() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 100 }; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  remove() { this.removed = true; }
}
function pointer(element, type, id, x, y) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: id, clientX: x, clientY: y });
  element.dispatchEvent(event);
}
test('analógico tem zona morta e limita diagonais a velocidade máxima', () => {
  assert.deepEqual(stickVector(2, 3, 50), { x: 0, y: 0 });
  assert.equal(stickVector(25, 0, 50).x, 0.5);
  const v = stickVector(200, -200, 50);
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-10);
});
test('dois dedos movem e miram de forma independente; cancelamento e pausa limpam controles', () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { createElement: () => new Element(), body: new Element() });
  try {
    let pauses = 0;
    const t = new TouchControls(() => pauses++);
    const [move, aim] = t.sticks;
    pointer(move.base, 'pointerdown', 1, 100, 50);
    pointer(aim.base, 'pointerdown', 2, 50, 0);
    assert.equal(t.move.x, 1); assert.equal(t.aim.y, -1);
    pointer(move.base, 'pointermove', 2, 0, 50);
    assert.equal(t.move.x, 1);
    pointer(aim.base, 'pointercancel', 2, 50, 0);
    assert.deepEqual(t.aim, { x: 0, y: 0 }); assert.equal(t.move.x, 1);
    const buttons = t.root.children[2].children;
    pointer(buttons[0], 'pointerdown', 3, 0, 0);
    assert.equal(t.consume('skill'), true); assert.equal(t.consume('skill'), false);
    pointer(buttons[3], 'pointerdown', 3, 0, 0); assert.equal(pauses, 1);
    window.dispatchEvent(new Event('blur'));
    assert.deepEqual(t.move, { x: 0, y: 0 });
    assert.equal(move.base.captured.size, 0);
    pointer(move.base, 'pointerdown', 4, 100, 50);
    t.setEnabled(false);
    assert.equal(t.root.hidden, true); assert.equal(t.move.x, 0);
    t.setEnabled(true);
    pointer(aim.base, 'pointerdown', 5, 100, 50);
    t.destroy();
    assert.equal(t.aim.x, 0); assert.equal(t.root.removed, true);
  } finally {
    globalThis.window = oldWindow; globalThis.document = oldDocument;
  }
});
