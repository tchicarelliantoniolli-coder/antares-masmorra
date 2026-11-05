import { GAME_W, GAME_H, titleStyle, textStyle } from '../config.js';
import { button, ButtonList, panel } from '../ui/widgets.js';
import { sound } from '../audio/Sound.js';
import { OnlineClient } from '../net/OnlineClient.js';

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }

  init(params) { this.online = !!params?.online; }

  create() {
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0);
    panel(this, GAME_W / 2 - 170, 130, 340, 270);
    this.add.text(GAME_W / 2, 162, this.online ? 'MENU (o jogo continua!)' : 'PAUSADO', titleStyle(this.online ? 12 : 18)).setOrigin(0.5);
    const buttons = [
      button(this, GAME_W / 2, 220, 260, 36, 'CONTINUAR', () => this.resume()),
      button(this, GAME_W / 2, 266, 260, 36, sound.muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO', () => {
        buttons[1].setLabel(sound.toggleMute() ? 'SOM: DESLIGADO' : 'SOM: LIGADO');
      }),
      button(this, GAME_W / 2, 312, 260, 36, this.online ? 'SAIR DA SALA' : 'DESISTIR (MENU)', () => this.quit())
    ];
    this.list = new ButtonList(this, buttons);
    this.add.text(GAME_W / 2, 366, 'Esc: continuar', textStyle(18, '#a39cc0')).setOrigin(0.5);
    this.input.keyboard.on('keydown-ESC', () => this.resume());
    this.input.keyboard.on('keydown-P', () => this.resume());
    this.prevStart = true;
  }

  resume() {
    this.scene.stop();
    if (this.online) {
      const g = this.scene.get('Game');
      g.menuOpen = false;
      g.input.setDefaultCursor('none');
    } else this.scene.resume('Game');
  }

  quit() {
    if (this.online) OnlineClient.get().leave();
    this.scene.stop('Game');
    this.scene.stop('Hud');
    this.scene.stop();
    this.scene.start('Menu');
  }

  update() {
    this.list.updatePad();
    const gp = this.input.gamepad;
    const pad = gp && gp.total ? gp.getAll().find((p) => p && p.connected) : null;
    if (pad) {
      const start = !!pad.buttons[9]?.pressed;
      if (start && !this.prevStart) this.resume();
      this.prevStart = start;
    }
  }
}
