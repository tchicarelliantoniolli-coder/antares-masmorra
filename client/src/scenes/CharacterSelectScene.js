import { GAME_W, GAME_H, textStyle, titleStyle, COLORS } from '../config.js';
import { panel, button } from '../ui/widgets.js';
import { sound } from '../audio/Sound.js';
import { hexToInt } from '../render/pixel.js';

const COLS = 7;
const CARD_W = 120, CARD_H = 124, GAP = 9;

/**
 * Seleção de personagem com cards (nome, matéria, arma inicial, habilidade e passivo).
 * Todos os 14 professores estão liberados (`playable` em characters.json).
 * (No lobby online, cada professor só pode ser escolhido por um jogador.)
 */
export class CharacterSelectScene extends Phaser.Scene {
  constructor() { super('CharacterSelect'); }

  init(params) {
    this.mode = params?.mode || 'solo';
  }

  create() {
    this.data_ = this.registry.get('data');
    this.chars = this.data_.characterList;
    this.cameras.main.fadeIn(200);
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1433, 0x1a1433, 0x2a1d47, 0x2a1d47, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);

    this.add.text(GAME_W / 2, 22, 'ESCOLHA SEU PROFESSOR', titleStyle(16)).setOrigin(0.5);

    const x0 = (GAME_W - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
    this.cards = this.chars.map((c, i) => this.makeCard(c, i, x0 + (i % COLS) * (CARD_W + GAP), 44 + Math.floor(i / COLS) * (CARD_H + GAP)));

    panel(this, 16, 314, GAME_W - 32, 216);
    this.detail = this.add.container(0, 0);
    this.ready = button(this, GAME_W - 112, 496, 170, 36, 'PRONTO!', () => this.confirm());
    this.add.text(30, 506, 'Setas/WASD: escolher   Enter: confirmar   Esc: voltar', textStyle(18, '#8a83ad'));

    const firstPlayable = Math.max(0, this.chars.findIndex((c) => c.playable));
    this.select(firstPlayable, true);

    this.input.keyboard.on('keydown', (ev) => {
      sound.unlock();
      const i = this.index;
      if (['ArrowRight', 'KeyD'].includes(ev.code)) this.select((i + 1) % this.chars.length);
      else if (['ArrowLeft', 'KeyA'].includes(ev.code)) this.select((i - 1 + this.chars.length) % this.chars.length);
      else if (['ArrowDown', 'KeyS'].includes(ev.code)) this.select((i + COLS) % this.chars.length);
      else if (['ArrowUp', 'KeyW'].includes(ev.code)) this.select((i - COLS + this.chars.length) % this.chars.length);
      else if (['Enter', 'Space', 'KeyE'].includes(ev.code)) this.confirm();
      else if (ev.code === 'Escape') this.back();
    });
    this.prevPad = {};
  }

  makeCard(c, i, x, y) {
    const cont = this.add.container(x, y);
    const bg = this.add.graphics();
    const sprite = this.add.sprite(CARD_W / 2, 46, 'char_' + c.id).setScale(2).play('char_' + c.id + '_idle');
    sprite.anims.setProgress(Math.random());
    const name = this.add.text(CARD_W / 2, 86, c.shortName, textStyle(20)).setOrigin(0.5);
    const subj = this.add.text(CARD_W / 2, 104, c.subjectShort || c.subject, textStyle(16, c.color)).setOrigin(0.5);
    cont.add([bg, sprite, name, subj]);
    const zone = this.add.zone(0, 0, CARD_W, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      sound.unlock();
      if (this.index === i) this.confirm(); else this.select(i);
    });
    cont.add(zone);
    const draw = (sel) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.35); bg.fillRect(3, 4, CARD_W, CARD_H);
      bg.fillStyle(sel ? 0x3b2f6b : COLORS.panel, 1); bg.fillRect(0, 0, CARD_W, CARD_H);
      bg.fillStyle(hexToInt(c.color), 0.85); bg.fillRect(0, 0, CARD_W, 4);
      bg.lineStyle(2, sel ? COLORS.gold : COLORS.border, 1); bg.strokeRect(1, 1, CARD_W - 2, CARD_H - 2);
    };
    draw(false);
    return { cont, sprite, draw, c };
  }

  select(i, silent = false) {
    if (this.index !== undefined) {
      const old = this.cards[this.index];
      old.draw(false);
      old.sprite.play('char_' + old.c.id + '_idle');
      this.tweens.killTweensOf(old.cont);
      old.cont.y = old.baseY ?? old.cont.y;
    }
    this.index = i;
    const card = this.cards[i];
    card.baseY = card.baseY ?? card.cont.y;
    card.draw(true);
    card.sprite.play('char_' + card.c.id + '_walk');
    this.tweens.add({ targets: card.cont, y: card.baseY - 4, duration: 220, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    if (!silent) sound.play('click');
    this.showDetail(card.c);
  }

  showDetail(c) {
    const d = this.detail;
    d.removeAll(true);
    const data = this.data_;
    d.add(this.add.sprite(96, 410, 'char_' + c.id).setScale(4).play('char_' + c.id + '_walk'));
    d.add(this.add.text(176, 326, c.name, titleStyle(c.name.length > 26 ? 10 : 12, '#ffffff')));
    d.add(this.add.text(176, 344, c.subject, textStyle(24, c.color)));

    const stats = [
      ['Vida', c.stats.hp + (c.passive.id === 'condicionamento' ? 3 : 0), 10, 0xe04848],
      ['Escudo', c.stats.shield + (c.passive.id === 'memoria_historica' ? 1 : 0), 8, 0x9aa7b8],
      ['Energia', c.stats.energy, 250, 0x3a8cff],
      ['Velocidade', c.stats.speed, 180, 0x5ee05e]
    ];
    const g = this.add.graphics();
    d.add(g);
    stats.forEach(([label, val, max, color], k) => {
      const y = 386 + k * 24;
      d.add(this.add.text(176, y - 2, label, textStyle(20, '#cfc8ef')));
      g.fillStyle(0x0d0b14, 1); g.fillRect(270, y + 3, 150, 12);
      g.fillStyle(color, 1); g.fillRect(270, y + 3, Math.round(150 * Math.min(1, val / max)), 12);
      d.add(this.add.text(428, y - 2, String(val), textStyle(20)));
    });

    const right = 470;
    const wpName = data.hasWeapon(c.starterWeapon) ? data.weapon(c.starterWeapon).name : c.starterWeaponName;
    if (data.hasWeapon(c.starterWeapon)) d.add(this.add.image(right + 8, 364, 'wpn_' + c.starterWeapon).setScale(2).setOrigin(0, 0.5));
    d.add(this.add.text(right + (data.hasWeapon(c.starterWeapon) ? 52 : 0), 354, 'Arma: ' + wpName, textStyle(20, '#ffffff')));
    d.add(this.add.text(right, 378, `Habilidade: ${c.skill.name}  (recarga ${c.skill.cooldown}s)`, textStyle(20, '#ffd23f')));
    d.add(this.add.text(right, 398, c.skill.description, textStyle(18, '#e0dcf5', { wordWrap: { width: 450 } })));
    d.add(this.add.text(right, 440, `Passivo: ${c.passive.name}`, textStyle(20, '#7be04a')));
    d.add(this.add.text(right, 460, c.passive.description, textStyle(18, '#e0dcf5', { wordWrap: { width: 280 } })));
  }

  confirm() {
    const c = this.chars[this.index];
    sound.play('select');
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', {
      mode: 'solo', players: [{ id: 'p1', characterId: c.id, name: 'Jogador 1', device: 'auto' }]
    }));
  }

  back() {
    this.scene.start('Menu');
  }

  update() {
    const gp = this.input.gamepad;
    if (!gp || !gp.total) return;
    const pad = gp.getAll().find((p) => p && p.connected);
    if (!pad) return;
    const press = (name, v) => { const was = this.prevPad[name]; this.prevPad[name] = v; return v && !was; };
    const i = this.index, n = this.chars.length;
    if (press('r', pad.right || pad.leftStick.x > 0.6)) this.select((i + 1) % n);
    if (press('l', pad.left || pad.leftStick.x < -0.6)) this.select((i - 1 + n) % n);
    if (press('d', pad.down || pad.leftStick.y > 0.6)) this.select((i + COLS) % n);
    if (press('u', pad.up || pad.leftStick.y < -0.6)) this.select((i - COLS + n) % n);
    if (press('a', !!pad.buttons[0]?.pressed)) this.confirm();
    if (press('b', !!pad.buttons[1]?.pressed)) this.back();
  }
}
