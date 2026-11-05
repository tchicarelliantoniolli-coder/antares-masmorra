import { GAME_W, GAME_H, textStyle, titleStyle } from '../config.js';
import { button, ButtonList, panel } from '../ui/widgets.js';
import { sound } from '../audio/Sound.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const data = this.registry.get('data');
    this.cameras.main.fadeIn(300);
    this.drawBackground();

    // Desfile dos professores
    this.parade = [];
    const list = data.characterList;
    list.forEach((c, i) => {
      const s = this.add.sprite(GAME_W - i * 70, GAME_H - 66, 'char_' + c.id).setScale(2).play('char_' + c.id + '_walk');
      s.anims.setProgress(Math.random());
      this.parade.push(s);
    });
    this.add.image(0, 0, 'px').setVisible(false);

    // Título
    const title = this.add.text(GAME_W / 2, 92, 'ANTARES', titleStyle(56, '#ffd23f', { stroke: '#3a1e6a', strokeThickness: 10 })).setOrigin(0.5);
    this.add.text(GAME_W / 2, 150, 'A MASMORRA ESCOLAR', titleStyle(18, '#ffffff', { stroke: '#3a1e6a', strokeThickness: 6 })).setOrigin(0.5);
    this.add.text(GAME_W / 2, 182, 'Os professores do Ensino Médio contra a escola mais caótica do mundo', textStyle(22, '#cfc8ef')).setOrigin(0.5);
    this.tweens.add({ targets: title, y: 98, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const cx = GAME_W / 2;
    const buttons = [
      button(this, cx, 240, 300, 36, 'JOGAR SOLO', () => this.goSelect()),
      button(this, cx, 286, 300, 36, 'CO-OP LOCAL', () => {}, { enabled: false, tag: 'chega na Etapa 3', size: 11 }),
      button(this, cx, 332, 300, 36, 'ONLINE (SALAS)', () => {}, { enabled: false, tag: 'chega na Etapa 2', size: 11 }),
      button(this, cx, 378, 300, 36, 'CONTROLES', () => this.toggleControls()),
      button(this, cx, 424, 300, 36, sound.muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO', () => {
        const m = sound.toggleMute();
        buttons[4].setLabel(m ? 'SOM: DESLIGADO' : 'SOM: LIGADO');
      })
    ];
    this.list = new ButtonList(this, buttons);

    this.add.text(8, GAME_H - 20, 'Uma homenagem aos professores do Ensino Médio do Colégio Antares Americana  •  v0.1 (Etapa 1 - MVP)', textStyle(16, '#8a83ad'));

    this.input.once('pointerdown', () => sound.unlock());
    this.input.keyboard.once('keydown', () => { sound.unlock(); sound.playMusic('menu'); });
    sound.playMusic('menu');
    this.input.keyboard.on('keydown-ESC', () => { if (this.controls) this.toggleControls(); });
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1433, 0x1a1433, 0x2d1f4f, 0x2d1f4f, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    // lousa ao fundo
    g.fillStyle(0x0f2a1e, 1); g.fillRect(120, 214, GAME_W - 240, 236);
    g.lineStyle(6, 0x8a5a3a, 1); g.strokeRect(117, 211, GAME_W - 234, 242);
    g.fillStyle(0xffffff, 0.05);
    for (let i = 0; i < 40; i++) g.fillRect(130 + Math.random() * (GAME_W - 270), 224 + Math.random() * 210, 12 + Math.random() * 40, 1);
    // chão
    g.fillStyle(0xc7955c, 1); g.fillRect(0, GAME_H - 52, GAME_W, 52);
    g.fillStyle(0xa87a46, 1);
    for (let x = 0; x < GAME_W; x += 32) g.fillRect(x, GAME_H - 52, 1, 52);
    g.fillRect(0, GAME_H - 52, GAME_W, 2);
    g.fillStyle(0x0d0b14, 0.85); g.fillRect(0, GAME_H - 22, GAME_W, 22);
    // fórmulas e palavras "escritas a giz"
    const words = ['E=mc²', 'a²+b²=c²', 'Hello!', 'H₂O', '1500 d.C.', 'DNA', 'Nota 1000', '∑', 'Brasil', '¿?', 'F=m·a', 'Capitu'];
    for (let i = 0; i < 14; i++) {
      const t = this.add.text(Math.random() * GAME_W, 200 + Math.random() * 260, words[i % words.length], textStyle(22, '#ffffff')).setAlpha(0.08);
      this.tweens.add({ targets: t, y: t.y - 20, alpha: 0.02, duration: 4000 + Math.random() * 3000, yoyo: true, repeat: -1 });
    }
  }

  toggleControls() {
    if (this.controls) {
      this.controls.destroy();
      this.controls = null;
      this.list.active = true;
      return;
    }
    this.list.active = false;
    const c = this.add.container(0, 0);
    const shade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setInteractive();
    c.add(shade);
    c.add(panel(this, 110, 70, 740, 400));
    c.add(this.add.text(GAME_W / 2, 100, 'CONTROLES', titleStyle(16)).setOrigin(0.5));
    const lines = [
      ['Mover', 'W A S D  (ou setas)', 'Analógico esquerdo'],
      ['Mirar', 'Mouse', 'Analógico direito (ou auto)'],
      ['Atirar', 'Botão esquerdo do mouse', 'RT / RB'],
      ['Habilidade', 'Espaço (ou botão direito)', 'LT / LB'],
      ['Interagir / pegar', 'E', 'A'],
      ['Trocar arma', 'Q', 'Y'],
      ['Pausar', 'Esc', 'Start'],
      ['Som liga/desliga', 'M', '—']
    ];
    c.add(this.add.text(140, 132, 'Ação', textStyle(22, '#ffd23f')));
    c.add(this.add.text(320, 132, 'Teclado e mouse', textStyle(22, '#ffd23f')));
    c.add(this.add.text(570, 132, 'Controle', textStyle(22, '#ffd23f')));
    lines.forEach(([a, k, p], i) => {
      const y = 166 + i * 30;
      c.add(this.add.text(140, y, a, textStyle(22)));
      c.add(this.add.text(320, y, k, textStyle(22, '#bfe0ff')));
      c.add(this.add.text(570, y, p, textStyle(22, '#bfffd0')));
    });
    c.add(this.add.text(GAME_W / 2, 430, 'Clique ou aperte Esc para fechar', textStyle(20, '#a39cc0')).setOrigin(0.5));
    shade.on('pointerdown', () => this.toggleControls());
    this.controls = c;
  }

  goSelect() {
    this.cameras.main.fadeOut(200);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('CharacterSelect', { mode: 'solo' }));
  }

  update(_, dt) {
    this.list.updatePad();
    for (const s of this.parade) {
      s.x += dt * 0.06;
      if (s.x > GAME_W + 40) s.x -= this.parade.length * 70;
    }
  }
}
