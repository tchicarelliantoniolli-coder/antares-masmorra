import { COLORS, FONT_TITLE, textStyle } from '../config.js';
import { sound } from '../audio/Sound.js';

/** Painel com borda estilo pixel. */
export function panel(scene, x, y, w, h, { fill = COLORS.panel, alpha = 0.92, border = COLORS.border } = {}) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRect(x + 3, y + 3, w, h);
  g.fillStyle(fill, alpha);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, border, 1);
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.lineStyle(1, 0xffffff, 0.08);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);
  return g;
}

/**
 * Botão com hover/foco. Retorna um objeto { container, setFocus, setEnabled, activate }.
 */
export function button(scene, x, y, w, h, label, onClick, { size = 12, enabled = true, tag = null } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const t = scene.add.text(0, tag ? -5 : 0, label, { fontFamily: FONT_TITLE, fontSize: size + 'px', color: '#ffffff' }).setOrigin(0.5);
  c.add([g, t]);
  let tagText = null;
  if (tag) {
    tagText = scene.add.text(0, 11, tag, textStyle(16, '#ffd23f')).setOrigin(0.5);
    c.add(tagText);
  }
  const state = { focus: false, enabled };
  const draw = () => {
    g.clear();
    const base = !state.enabled ? 0x2a2540 : state.focus ? 0x6b4fd8 : 0x3b3260;
    g.fillStyle(0x000000, 0.4); g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    g.fillStyle(base, 1); g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(0xffffff, state.enabled ? 0.12 : 0.04); g.fillRect(-w / 2, -h / 2, w, 3);
    g.lineStyle(2, state.focus && state.enabled ? COLORS.gold : 0x1b1424, 1);
    g.strokeRect(-w / 2, -h / 2, w, h);
    t.setColor(state.enabled ? '#ffffff' : '#6d6690');
  };
  draw();
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  c.add(zone);
  const api = {
    container: c,
    setFocus(v) { state.focus = v; draw(); },
    setEnabled(v) { state.enabled = v; draw(); },
    setLabel(s) { t.setText(s); },
    activate() {
      sound.unlock();
      if (!state.enabled) { sound.play('no_energy'); return; }
      sound.play('select');
      onClick();
    },
    get enabled() { return state.enabled; }
  };
  zone.on('pointerover', () => { api.onHover?.(); });
  zone.on('pointerdown', () => api.activate());
  return api;
}

/** Lista vertical de botões navegável por teclado/controle. */
export class ButtonList {
  constructor(scene, buttons) {
    this.scene = scene;
    this.buttons = buttons;
    this.index = Math.max(0, buttons.findIndex((b) => b.enabled));
    buttons.forEach((b, i) => { b.onHover = () => this.focus(i); });
    this.focus(this.index, true);
    const kb = scene.input.keyboard;
    this.handler = (ev) => {
      if (!this.active) return;
      if (['ArrowDown', 'KeyS'].includes(ev.code)) this.move(1);
      else if (['ArrowUp', 'KeyW'].includes(ev.code)) this.move(-1);
      else if (['Enter', 'Space', 'KeyE'].includes(ev.code)) this.buttons[this.index].activate();
    };
    kb.on('keydown', this.handler);
    this.active = true;
    this.prevPad = {};
    scene.events.once('shutdown', () => kb.off('keydown', this.handler));
  }
  focus(i, silent = false) {
    this.index = i;
    this.buttons.forEach((b, j) => b.setFocus(j === i));
    if (!silent) sound.play('click');
  }
  move(d) {
    let i = this.index;
    for (let n = 0; n < this.buttons.length; n++) {
      i = (i + d + this.buttons.length) % this.buttons.length;
      if (this.buttons[i].enabled) break;
    }
    this.focus(i);
  }
  /** Chame no update() da cena para navegar com o controle. */
  updatePad() {
    const gp = this.scene.input.gamepad;
    if (!this.active || !gp || !gp.total) return;
    const pad = gp.getAll().find((p) => p && p.connected);
    if (!pad) return;
    const press = (name, v) => { const was = this.prevPad[name]; this.prevPad[name] = v; return v && !was; };
    if (press('down', pad.down || pad.leftStick.y > 0.6)) this.move(1);
    if (press('up', pad.up || pad.leftStick.y < -0.6)) this.move(-1);
    if (press('a', !!pad.buttons[0]?.pressed)) this.buttons[this.index].activate();
  }
}
