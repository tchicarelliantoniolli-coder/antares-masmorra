import { GAME_W, GAME_H, titleStyle, textStyle } from '../config.js';
import { button, ButtonList, panel } from '../ui/widgets.js';
import { sound } from '../audio/Sound.js';
import { OnlineClient } from '../net/OnlineClient.js';

/** Tela de vitória ou derrota com as estatísticas da partida (solo, co-op local ou online). */
export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(params) { this.params = params; }

  create() {
    const { victory, stats = {}, players = [], mode, floor = 1 } = this.params;
    const data = this.registry.get('data');
    this.cameras.main.fadeIn(400);
    const g = this.add.graphics();
    g.fillGradientStyle(victory ? 0x1f3a2a : 0x3a1420, victory ? 0x1f3a2a : 0x3a1420, 0x0d0b14, 0x0d0b14, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    sound.playMusic(victory ? 'victory' : 'defeat');
    const title = this.params.disconnected ? 'CONEXÃO PERDIDA' : victory ? 'VITÓRIA!' : 'FICOU DE RECUPERAÇÃO...';
    this.add.text(GAME_W / 2, 50, title, titleStyle(victory ? 32 : 22, victory ? '#ffd23f' : '#ff7a7a', { stroke: '#1b1424', strokeThickness: 8 })).setOrigin(0.5);
    this.add.text(GAME_W / 2, 90, victory
      ? 'A coordenação foi vencida! A escola inteira está livre!'
      : `Parou no Andar ${floor}. Toda prova tem uma segunda chamada!`, textStyle(24, '#ffffff')).setOrigin(0.5);

    // personagens
    const n = Math.max(1, players.length);
    players.forEach((p, i) => {
      const x = GAME_W / 2 + (i - (n - 1) / 2) * 200;
      const s = this.add.sprite(x, 170, 'char_' + p.charId).setScale(3);
      if (victory) {
        s.play('char_' + p.charId + '_walk');
        this.tweens.add({ targets: s, y: 158, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.out', delay: i * 80 });
      } else s.setAngle(90).setTint(0x8888aa);
      this.add.text(x, 222, p.name, textStyle(20, data.character(p.charId).color)).setOrigin(0.5);
      this.add.text(x, 242, `${p.kills} inimigos • ${p.damage} de dano`, textStyle(18, '#cfc8ef')).setOrigin(0.5);
    });
    if (victory) this.time.addEvent({ delay: 280, loop: true, callback: () => this.confetti() });

    panel(this, 230, 270, 500, 150);
    const t = stats.time || 0;
    const mins = Math.floor(t / 60), secs = Math.floor(t % 60).toString().padStart(2, '0');
    const rows = [
      ['Tempo', `${mins}:${secs}`],
      ['Andares vencidos', `${victory ? 3 : Math.max(0, floor - 1)} de 3`],
      ['Inimigos derrotados', stats.kills ?? 0],
      ['Salas liberadas', stats.roomsCleared ?? 0]
    ];
    rows.forEach(([k, v], i) => {
      this.add.text(254, 286 + i * 32, k, textStyle(24, '#cfc8ef'));
      this.add.text(706, 286 + i * 32, String(v), textStyle(24, '#ffffff')).setOrigin(1, 0);
    });

    let buttons;
    if (mode === 'online') {
      const client = OnlineClient.get();
      const inRoom = !!client.code && client.connected;
      buttons = [
        button(this, 330, 470, 280, 38, 'VOLTAR À SALA', () => this.scene.start('Lobby', { mode: 'online' }), { enabled: inRoom }),
        button(this, 640, 470, 260, 38, 'MENU', () => { client.leave(); this.scene.start('Menu'); })
      ];
    } else if (mode === 'local') {
      const replay = this.params.replay;
      buttons = [
        button(this, 230, 470, 240, 38, 'JOGAR DE NOVO', () => this.scene.start('Game', replay)),
        button(this, 490, 470, 240, 38, 'TROCAR TIME', () => this.scene.start('Lobby', { mode: 'local' })),
        button(this, 730, 470, 200, 38, 'MENU', () => this.scene.start('Menu'))
      ];
    } else {
      const replay = this.params.replay;
      buttons = [
        button(this, 230, 470, 240, 38, 'JOGAR DE NOVO', () => this.scene.start('Game', replay)),
        button(this, 490, 470, 260, 38, 'TROCAR PROFESSOR', () => this.scene.start('CharacterSelect', { mode: 'solo' })),
        button(this, 740, 470, 200, 38, 'MENU', () => this.scene.start('Menu'))
      ];
    }
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
