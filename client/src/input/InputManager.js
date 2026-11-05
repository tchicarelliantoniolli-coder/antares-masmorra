/**
 * Lê teclado + mouse e controle (gamepad) e produz o "input" que a simulação entende:
 *   { moveX, moveY, aim, fire, skill, interact, swap }
 *
 * Teclado/mouse: WASD move, mouse mira e atira, Espaço = habilidade, E = interagir/pegar, Q = trocar arma.
 * Controle: analógico esquerdo move, direito mira (sem mira = mira automática no inimigo mais próximo),
 *           RT/RB atira, LT/LB habilidade, A interage, Y troca arma, Start pausa.
 */
export class InputManager {
  constructor(scene) {
    this.scene = scene;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard.addKeys({
      W: K.W, A: K.A, S: K.S, D: K.D,
      UP: K.UP, DOWN: K.DOWN, LEFT: K.LEFT, RIGHT: K.RIGHT,
      SPACE: K.SPACE, E: K.E, Q: K.Q, F: K.F
    });
    scene.input.mouse?.disableContextMenu();
    this.mode = 'mouse';
    this.lastAim = 0;
    this.prevPad = {};
    scene.input.on('pointermove', () => { this.mode = 'mouse'; });
    scene.input.on('pointerdown', () => { this.mode = 'mouse'; });
    this.keyFire = false;
  }

  get pad() {
    const gp = this.scene.input.gamepad;
    if (!gp || !gp.total) return null;
    return gp.getAll().find((p) => p && p.connected) || null;
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

  /** Botão de pausa do controle (Start) apertado neste quadro? */
  pausePressed() {
    const pad = this.pad;
    return pad ? this.padPressed(pad, 9) : false;
  }

  /** world/player são usados para a mira (posição do jogador e mira automática). */
  poll(world, player) {
    const k = this.keys;
    const J = Phaser.Input.Keyboard.JustDown;
    let mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const pointer = this.scene.input.activePointer;
    const right = pointer.rightButtonDown();
    let fire = pointer.leftButtonDown();
    let skill = J(k.SPACE) || (right && !this.rightWas); // botão direito também usa a habilidade
    this.rightWas = right;
    let interact = J(k.E) || J(k.F);
    let swap = J(k.Q);
    let aim = this.lastAim;

    if (player && this.mode === 'mouse') {
      const cam = this.scene.cameras.main;
      const wp = cam.getWorldPoint(pointer.x, pointer.y);
      aim = Math.atan2(wp.y - (player.y - 4), wp.x - player.x);
    }

    const pad = this.pad;
    if (pad) {
      const lx = pad.leftStick.x, ly = pad.leftStick.y;
      const rx = pad.rightStick.x, ry = pad.rightStick.y;
      const dead = 0.22;
      const anyPad = Math.hypot(lx, ly) > dead || Math.hypot(rx, ry) > dead || pad.buttons.some((b) => b && b.pressed);
      if (anyPad) this.mode = 'pad';
      if (Math.hypot(lx, ly) > dead) { mx = lx; my = ly; }
      if (pad.left) mx = -1; else if (pad.right) mx = 1;
      if (pad.up) my = -1; else if (pad.down) my = 1;
      if (this.mode === 'pad') {
        if (Math.hypot(rx, ry) > 0.35) {
          aim = Math.atan2(ry, rx);
        } else if (player) {
          aim = autoAim(world, player) ?? (Math.hypot(mx, my) > 0.2 ? Math.atan2(my, mx) : this.lastAim);
        }
      }
      fire = fire || this.padDown(pad, 7) || this.padDown(pad, 5);
      skill = this.padPressed(pad, 6) || this.padPressed(pad, 4) || skill;
      interact = this.padPressed(pad, 0) || interact;
      swap = this.padPressed(pad, 3) || swap;
    }

    this.lastAim = aim;
    return { moveX: mx, moveY: my, aim, fire, skill, interact, swap };
  }
}

/** Mira automática: inimigo vivo mais próximo com linha de visão. */
function autoAim(world, p) {
  if (!world) return null;
  let best = null, bd = 420;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && world.map.lineOfSight(p.x, p.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best ? Math.atan2(best.y - p.y, best.x - p.x) : null;
}
