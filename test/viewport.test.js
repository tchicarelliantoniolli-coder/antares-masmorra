import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupViewport } from '../client/src/input/Viewport.js';

class Button extends EventTarget {
  attrs = {};
  setAttribute(key, value) { this.attrs[key] = value; }
  blur() {}
}
function fixture({ native = true, reject = false, webkit = false } = {}) {
  const button = new Button(), status = {};
  const doc = Object.assign(new EventTarget(), {
    documentElement: {},
    getElementById: id => id === 'fullscreen-toggle' ? button : status
  });
  const win = { clearTimeout() {}, setTimeout() {}, performance: { now: () => 100 } };
  if (native) {
    doc.documentElement[webkit ? 'webkitRequestFullscreen' : 'requestFullscreen'] = async () => {
      if (reject) throw new Error('denied');
      doc[webkit ? 'webkitFullscreenElement' : 'fullscreenElement'] = doc.documentElement;
    };
    doc[webkit ? 'webkitExitFullscreen' : 'exitFullscreen'] = async () => {
      doc.fullscreenElement = null; doc.webkitFullscreenElement = null;
    };
  }
  setupViewport(doc, win);
  return { doc, button, status };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('tela cheia entra e sai e acompanha saída feita pelo navegador', async () => {
  for (const webkit of [false, true]) {
    const { doc, button } = fixture({ webkit });
    button.dispatchEvent(new Event('click')); await flush();
    assert.equal(button.attrs['aria-pressed'], 'true');
    assert.equal(button.textContent, 'Sair da tela cheia');
    button.dispatchEvent(new Event('click')); await flush();
    assert.equal(button.attrs['aria-pressed'], 'false');
    button.dispatchEvent(new Event('click')); await flush();
    doc.fullscreenElement = null; doc.webkitFullscreenElement = null;
    doc.dispatchEvent(new Event('fullscreenchange'));
    assert.equal(button.textContent, 'Tela cheia');
  }
});
test('navegador sem suporte e pedido rejeitado mostram orientação sem simular tela cheia', async () => {
  for (const options of [{ native: false }, { reject: true }]) {
    const { button, status } = fixture(options);
    button.dispatchEvent(new Event('click')); await flush();
    assert.match(status.textContent, /Tela de Início/);
    assert.equal(button.attrs['aria-pressed'], 'false');
  }
});
test('bloqueia pinça e toque duplo sem bloquear movimento de um dedo', () => {
  const { doc } = fixture();
  const send = (type, fields = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, fields);
    doc.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(send('gesturestart'), true);
  assert.equal(send('gesturechange'), true);
  assert.equal(send('touchmove', { touches: [{}, {}] }), true);
  assert.equal(send('touchmove', { touches: [{}] }), false);
  const tap = { touches: [], changedTouches: [{ clientX: 20, clientY: 30 }] };
  assert.equal(send('touchend', tap), false);
  assert.equal(send('touchend', tap), true);
});

test('texto do jogo não seleciona nem abre menu; cliques e campos de texto continuam livres', () => {
  const { doc, button } = fixture();
  const selection = new Event('selectstart', { cancelable: true });
  doc.dispatchEvent(selection);
  assert.equal(selection.defaultPrevented, true);
  const menu = new Event('contextmenu', { cancelable: true });
  doc.dispatchEvent(menu); assert.equal(menu.defaultPrevented, true);
  const click = new Event('click', { cancelable: true });
  doc.dispatchEvent(click); assert.equal(click.defaultPrevented, false);
  doc.closest = () => ({});
  const editableSelection = new Event('selectstart', { cancelable: true });
  doc.dispatchEvent(editableSelection); assert.equal(editableSelection.defaultPrevented, false);
});
