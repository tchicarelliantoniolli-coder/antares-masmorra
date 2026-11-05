import { GAME_W, GAME_H, titleStyle, textStyle } from '../config.js';
import { button, ButtonList, panel } from '../ui/widgets.js';
import { sound } from '../audio/Sound.js';

/** Tela de vitória ou derrota com as estatísticas da partida. */
export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(params) { this.params = params; }

  create() {
    const { victory, stats, characterId, player } = this.params;
    const data = this.registry.get('data');
    const c = data.character(characterId);
    this.cameras.main.fadeIn(400);
    const g = this.add.graphics();
    g.fillGradientStyle(victory ? 0x1f3a2a : 0x3a1420, victory ? 0x1f3a2a : 0x3a1420, 0x0d0b14, 0x0d0b14, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    sound.playMusic(victory ? 'victory' : 'defeat');
    this.add.text(GAME_W / 2, 56, victory ? 'VITÓRIA!' : 'FICOU DE RECUPERAÇÃO...', titleStyle(victory ? 32 : 22, victory ? '#ffd23f' : '#ff7a7a', { stroke: '#1b1424', strokeThickness: 8 })).setOrigin(0.5);
    this.add.text(GAME_W / 2, 96, victory
      ? 'A Máquina de Xerox foi desligada. O Andar 1 está livre!'
      : 'Todos caíram. Mas toda prova tem uma segunda chamada!', textStyle(24, '#ffffff')).setOrigin(0.5);

    const s = this.add.sprite(230, 270, 'char_' + characterId).setScale(5);
    if (victory) {
      s.play('char_' + characterId + '_walk');
      this.tweens.add({ targets: s, y: 250, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.out' });
      this.time.addEvent({ delay: 280, loop: true, callback: () => this.confetti() });
    } else {
      s.setAngle(90).setTint(0x8888aa);
    }
    this.add.text(230, 350, c.name, textStyle(22, c.color)).setOrigin(0.5);

    panel(this, 420, 140, 470, 250);
    const mins = Math.floor(stats.time / 60), secs = Math.floor(stats.time % 60).toString().padStart(2, '0');
    const rows = [
      ['Tempo', `${mins}:${secs}`],
      ['Inimigos derrotados', stats.kills],
      ['Dano causado', player.damage],
      ['Salas liberadas', stats.roomsCleared],
      ['Moedas', player.coins],
      ['Armas no fim', player.weapons.map((id) => data.weapon(id).name).join(' + ')]
    ];
    rows.forEach(([k, v], i) => {
      this.add.text(444, 162 + i * 36, k, textStyle(24, '#cfc8ef'));
      this.add.text(866, 162 + i * 36, String(v), textStyle(24, '#ffffff', { align: 'right', wordWrap: { width: 250 } })).setOrigin(1, 0);
    });

    const buttons = [
      button(this, 250, 470, 260, 38, 'JOGAR DE NOVO', () => this.scene.start('Game', { characterId, mode: 'solo' })),
      button(this, 520, 470, 260, 38, 'TROCAR PROFESSOR', () => this.scene.start('CharacterSelect', { mode: 'solo' })),
      button(this, 770, 470, 200, 38, 'MENU', () => this.scene.start('Menu'))
    ];
    this.list = new ButtonList(this, buttons);
    this.input.keyboard.on('keydown-RIGHT', () => this.list.move(1));
    this.input.keyboard.on('keydown-LEFT', () => this.list.move(-1));
  }

  confetti() {
    const colors = [0xffd23f, 0xff7a1a, 0x4aa8ff, 0x5ee05e, 0xe04ad0];
    for (let i = 0; i < 3; i++) {
      const r = this.add.rectangle(Math.random() * GAME_W, -10, 4, 6, colors[Math.floor(Math.random() * colors.length)]);
      this.tweens.add({ targets: r, y: GAME_H + 10, x: r.x + (Math.random() - 0.5) * 120, angle: 360, duration: 2500 + Math.random() * 1500, onComplete: () => r.destroy() });
    }
  }

  update() { this.list.updatePad(); }
}
