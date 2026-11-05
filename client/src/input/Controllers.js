import { DEFAULT_AIM_DIST } from '/shared/sim/constants.js';

/**
 * Controles por dispositivo. Cada jogador local tem um "controller" que produz o input da simulação:
 *   { moveX, moveY, aim, aimDist, fire, skill, interact, swap }
 *
 * Dispositivos:
 *  - 'auto'  (solo/online): teclado + mouse e qualquer controle conectado
 *  - 'kbm'   (co-op, jogador da esquerda): WASD, mouse mira/atira, Espaço habilidade, E pegar, Q trocar
 *  - 'kb2'   (co-op, jogador da direita no mesmo teclado): setas movem, mira automática,
 *            Enter atira, Shift direito habilidade, "." pegar, "," trocar
 *  - 'pad0'..'pad3': controle 1 a 4 (analógico esquerdo move, direito mira ou mira automática,
 *            RT/RB atira, LT/LB habilidade, A pega, Y troca, Start pausa)
 */

export const DEVICE_LABELS = {
  auto: 'Teclado + mouse / controle',
  kbm: 'Teclado (WASD) + mouse',
  kb2: 'Teclado (setas) — Enter atira',
  pad0: 'Controle 1', pad1: 'Controle 2', pad2: 'Controle 3', pad3: 'Controle 4'
};

/** Guarda o estado das teclas pelo "código físico" (funciona igual em teclado ABNT e US). */
export class KeyTracker {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.onDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    this.onUp = (e) => this.down.delete(e.code);
    this.onBlur = () => this.down.clear();
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }
  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() { this.pressed.clear(); }
  destroy() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}

function getPads(scene) {
  const gp = scene.input.gamepad;
  if (!gp || !gp.total) return [];
  return gp.getAll().filter((p) => p && p.connected);
}

/** Mira automática: inimigo vivo mais próximo com linha de visão. */
export function autoAim(world, p) {
  if (!world) return null;
  let best = null, bd = 420;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.def?.invulnerable) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && world.map.lineOfSight(p.x, p.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best ? Math.atan2(best.y - p.y, best.x - p.x) : null;
}

/** Distância até o inimigo que a mira automática escolheria (ou null). */
export function autoAimDist(world, p) {
  if (!world) return null;
  let bd = 420, found = false;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.def?.invulnerable) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && world.map.lineOfSight(p.x, p.y, e.x, e.y)) { bd = d; found = true; }
  }
  return found ? bd : null;
}

export class Controller {
  constructor(scene, keys, device) {
    this.scene = scene;
    this.keys = keys;
    this.device = device;
    this.lastAim = 0;
    this.prevPad = {};
    this.mode = device.startsWith('pad') ? 'pad' : device === 'kb2' ? 'keys' : 'mouse';
    this.rightWas = false;
    if (device === 'auto' || device === 'kbm') {
      scene.input.on('pointermove', () => { this.mode = 'mouse'; });
      scene.input.on('pointerdown', () => { this.mode = 'mouse'; });
    }
  }

  pad() {
    const pads = getPads(this.scene);
    if (this.device === 'auto') return pads[0] || null;
    if (this.device.startsWith('pad')) {
      const idx = Number(this.device.slice(3));
      return pads.find((p) => p.index === idx) || pads[idx] || null;
    }
    return null;
  }

  padPressed(pad, idx) {
    const b = pad.buttons[idx];
    const down = !!(b && (b.pressed || b.value > 0.5));
    const was = this.prevPad[idx];
    this.prevPad[idx] = down;
    return down && !was;
  }

  padDown(pad, idx) {
    const b = pad.buttons[idx];
    return !!(b && (b.pressed || b.value > 0.5));
  }

  pausePressed() {
    const k = this.keys;
    if ((this.device === 'auto' || this.device === 'kbm') && (k.wasPressed('Escape') || k.wasPressed('KeyP'))) return true;
    const pad = this.pad();
    return pad ? this.padPressed(pad, 9) : false;
  }

  poll(world, player) {
    const k = this.keys;
    const d = this.device;
    let mx = 0, my = 0, fire = false, skill = false, interact = false, swap = false;
    let aim = this.lastAim;
    let aimDist = null;
    const usesLeft = d === 'auto' || d === 'kbm';
    const usesArrows = d === 'auto' || d === 'kb2';

    if (usesLeft) {
      mx += (k.isDown('KeyD') ? 1 : 0) - (k.isDown('KeyA') ? 1 : 0);
      my += (k.isDown('KeyS') ? 1 : 0) - (k.isDown('KeyW') ? 1 : 0);
      skill = k.wasPressed('Space');
      interact = k.wasPressed('KeyE') || k.wasPressed('KeyF');
      swap = k.wasPressed('KeyQ');
      const ptr = this.scene.input.activePointer;
      const right = ptr.rightButtonDown();
      fire = ptr.leftButtonDown();
      skill = skill || (right && !this.rightWas);
      this.rightWas = right;
      if (player && this.mode === 'mouse') {
        const wp = this.scene.cameras.main.getWorldPoint(ptr.x, ptr.y);
        aim = Math.atan2(wp.y - (player.y - 4), wp.x - player.x);
        aimDist = Math.hypot(wp.y - (player.y - 4), wp.x - player.x);
      }
    }
    if (usesArrows) {
      const ax = (k.isDown('ArrowRight') ? 1 : 0) - (k.isDown('ArrowLeft') ? 1 : 0);
      const ay = (k.isDown('ArrowDown') ? 1 : 0) - (k.isDown('ArrowUp') ? 1 : 0);
      if (ax || ay) { mx = ax; my = ay; }
      if (d === 'kb2') {
        fire = k.isDown('Enter') || k.isDown('NumpadEnter') || k.isDown('ControlRight');
        skill = k.wasPressed('ShiftRight') || k.wasPressed('Slash');
        interact = k.wasPressed('Period') || k.wasPressed('Numpad0');
        swap = k.wasPressed('Comma');
      }
    }

    const pad = this.pad();
    if (pad) {
      const lx = pad.leftStick.x, ly = pad.leftStick.y;
      const rx = pad.rightStick.x, ry = pad.rightStick.y;
      const dead = 0.22;
      const anyPad = Math.hypot(lx, ly) > dead || Math.hypot(rx, ry) > dead || pad.buttons.some((b) => b && b.pressed);
      if (anyPad) this.mode = 'pad';
      if (Math.hypot(lx, ly) > dead) { mx = lx; my = ly; }
      if (pad.left) mx = -1; else if (pad.right) mx = 1;
      if (pad.up) my = -1; else if (pad.down) my = 1;
      if (this.mode === 'pad' && Math.hypot(rx, ry) > 0.35) aim = Math.atan2(ry, rx);
      else if (this.mode === 'pad') this.autoAimFor(world, player, mx, my, (a) => { aim = a; });
      fire = fire || this.padDown(pad, 7) || this.padDown(pad, 5);
      skill = this.padPressed(pad, 6) || this.padPressed(pad, 4) || skill;
      interact = this.padPressed(pad, 0) || interact;
      swap = this.padPressed(pad, 3) || swap;
    }
    if (this.mode === 'keys') this.autoAimFor(world, player, mx, my, (a) => { aim = a; });

    this.lastAim = aim;
    if (aimDist === null) aimDist = (player && autoAimDist(world, player)) ?? DEFAULT_AIM_DIST;
    return { moveX: mx, moveY: my, aim, aimDist, fire, skill, interact, swap };
  }

  autoAimFor(world, player, mx, my, set) {
    if (!player) return;
    const a = autoAim(world, player);
    if (a !== null) set(a);
    else if (Math.hypot(mx, my) > 0.2) set(Math.atan2(my, mx));
  }

  /** Mostra a mira do mouse? */
  get showsCrosshair() { return (this.device === 'auto' || this.device === 'kbm') && this.mode === 'mouse'; }
}
