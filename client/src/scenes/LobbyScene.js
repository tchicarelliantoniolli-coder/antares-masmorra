import { GAME_W, GAME_H, COLORS, textStyle, titleStyle } from '../config.js';
import { button } from '../ui/widgets.js';
import { sound } from '../audio/Sound.js';
import { KeyTracker, DEVICE_LABELS } from '../input/Controllers.js';
import { OnlineClient } from '../net/OnlineClient.js';
import { OnlineSession } from '../net/OnlineSession.js';
import { hexToInt } from '../render/pixel.js';

const SLOT_W = 222, SLOT_H = 330;

/**
 * Lobby de até 4 jogadores. Cada professor só pode ser escolhido uma vez.
 *  - mode 'local': co-op no mesmo computador. Jogador 1 = teclado + mouse. Para entrar:
 *      ENTER = jogador no teclado (setas) • botão A = controle.
 *  - mode 'online': sala no servidor com código; todos confirmam "pronto" e a partida começa.
 */
export class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  init(params) {
    this.mode = params.mode || 'local';
  }

  create() {
    this.data_ = this.registry.get('data');
    this.playable = this.data_.characterList.filter((c) => c.playable);
    this.cameras.main.fadeIn(200);
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1433, 0x1a1433, 0x2a1d47, 0x2a1d47, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    this.title = this.add.text(GAME_W / 2, 24, '', titleStyle(14)).setOrigin(0.5);
    this.sub = this.add.text(GAME_W / 2, 46, '', textStyle(20, '#cfc8ef')).setOrigin(0.5);
    this.slotLayer = this.add.container(0, 0);
    this.help = this.add.text(GAME_W / 2, GAME_H - 66, '', textStyle(18, '#a39cc0', { align: 'center' })).setOrigin(0.5);
    this.msg = this.add.text(GAME_W / 2, GAME_H - 92, '', textStyle(20, '#ffd23f')).setOrigin(0.5);
    this.readyBtn = button(this, GAME_W / 2 - 120, GAME_H - 24, 220, 34, 'PRONTO!', () => this.toggleMyReady());
    this.backBtn = button(this, GAME_W / 2 + 130, GAME_H - 24, 180, 34, 'SAIR', () => this.back());
    this.keys = new KeyTracker();
    this.prevPad = {};
    this.countdown = 0;
    this.events.once('shutdown', () => { this.keys.destroy(); this.offs?.forEach((f) => f()); });

    if (this.mode === 'local') {
      this.slots = [{ id: 'p1', name: 'Jogador 1', device: 'kbm', characterId: this.playable[0].id, ready: false }];
      this.title.setText('CO-OP LOCAL');
      this.sub.setText('2 a 4 jogadores no mesmo computador');
    } else {
      this.client = OnlineClient.get();
      this.title.setText('SALA ONLINE');
      this.offs = [
        this.client.on('room:state', () => this.render()),
        this.client.on('game:start', (msg) => this.startOnline(msg)),
        this.client.on('disconnect', () => this.msg.setText('Conexão perdida com o servidor.'))
      ];
    }
    this.render();
  }

  // ------------------------------------------------------------------ dados
  currentSlots() {
    if (this.mode === 'local') return this.slots;
    const st = this.client.roomState;
    if (!st) return [];
    return st.players.map((p) => ({ ...p, mine: p.id === this.client.playerId }));
  }

  takenBy(characterId, exceptId) {
    return this.currentSlots().some((s) => s.id !== exceptId && s.characterId === characterId);
  }

  nextChar(slot, dir) {
    const list = this.playable;
    let i = list.findIndex((c) => c.id === slot.characterId);
    for (let n = 0; n < list.length; n++) {
      i = (i + dir + list.length) % list.length;
      if (!this.takenBy(list[i].id, slot.id)) return list[i].id;
    }
    return slot.characterId;
  }

  async changeChar(slot, dir) {
    if (slot.ready) return;
    const next = this.nextChar(slot, dir);
    sound.play('click');
    if (this.mode === 'local') {
      slot.characterId = next;
      this.render();
    } else {
      const r = await this.client.setCharacter(next);
      if (!r.ok && r.error) this.msg.setText(r.error);
    }
  }

  async toggleReady(slot) {
    sound.unlock();
    if (this.mode === 'local') {
      if (this.takenBy(slot.characterId, slot.id)) { this.msg.setText('Esse professor já foi escolhido!'); return; }
      slot.ready = !slot.ready;
      sound.play(slot.ready ? 'select' : 'click');
      this.render();
    } else {
      const r = await this.client.setReady(!slot.ready);
      if (!r.ok && r.error) this.msg.setText(r.error);
      else sound.play('select');
    }
  }

  toggleMyReady() {
    const slots = this.currentSlots();
    const mine = this.mode === 'local' ? slots[0] : slots.find((s) => s.mine);
    if (mine) this.toggleReady(mine);
  }

  back() {
    if (this.mode === 'online') this.client.leave();
    this.scene.start('Menu');
  }

  // ------------------------------------------------------------------ desenho
  render() {
    this.slotLayer.removeAll(true);
    const slots = this.currentSlots();
    if (this.mode === 'online') {
      const code = this.client.code || '----';
      this.title.setText(`SALA ONLINE — CÓDIGO: ${code}`);
      this.sub.setText('Passe o código para os amigos entrarem (até 4 jogadores)');
      this.help.setText('A/D ou ←/→: trocar professor   •   ENTER/ESPAÇO: pronto   •   ESC: sair da sala\nA partida começa quando todos estiverem prontos.');
    } else {
      this.help.setText('J1 (teclado+mouse): A/D trocam, ESPAÇO = pronto   •   Teclado (setas): ENTER entra/pronto, ←/→ trocam\nControle: A entra/pronto, ←/→ trocam, B sai   •   Começa quando todos (2+) estiverem prontos');
    }
    for (let i = 0; i < 4; i++) {
      const x = 22 + i * (SLOT_W + 8), y = 64;
      const s = slots[i];
      const c = this.add.container(x, y);
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.35).fillRect(3, 4, SLOT_W, SLOT_H);
      bg.fillStyle(s ? 0x2a2540 : COLORS.panel, 0.95).fillRect(0, 0, SLOT_W, SLOT_H);
      const ch = s ? this.data_.character(s.characterId) : null;
      if (ch) bg.fillStyle(hexToInt(ch.color), 0.9).fillRect(0, 0, SLOT_W, 4);
      bg.lineStyle(2, s?.ready ? 0x5ee05e : s?.mine || (this.mode === 'local' && i === 0) ? COLORS.gold : COLORS.border, 1).strokeRect(1, 1, SLOT_W - 2, SLOT_H - 2);
      c.add(bg);
      c.add(this.add.text(SLOT_W / 2, 12, `JOGADOR ${i + 1}${s?.host ? ' ★' : ''}`, titleStyle(9, '#ffffff')).setOrigin(0.5, 0));
      if (!s) {
        const txt = this.mode === 'local'
          ? 'Vaga livre\n\nPara entrar:\nENTER\n(teclado — setas)\n\nou botão A\nde um controle'
          : `Esperando\njogador...\n\nCódigo da sala:\n${this.client.code || ''}`;
        c.add(this.add.text(SLOT_W / 2, 120, txt, textStyle(20, '#8a83ad', { align: 'center' })).setOrigin(0.5, 0));
        this.slotLayer.add(c);
        continue;
      }
      c.add(this.add.text(SLOT_W / 2, 32, s.name + (s.mine ? ' (você)' : ''), textStyle(20, s.mine ? '#ffd23f' : '#ffffff')).setOrigin(0.5, 0));
      if (this.mode === 'local') c.add(this.add.text(SLOT_W / 2, 52, DEVICE_LABELS[s.device], textStyle(16, '#bfe0ff')).setOrigin(0.5, 0));
      const spr = this.add.sprite(SLOT_W / 2, 124, 'char_' + ch.id).setScale(3).play('char_' + ch.id + (s.ready ? '_walk' : '_idle'));
      c.add(spr);
      c.add(this.add.text(SLOT_W / 2, 170, ch.shortName, textStyle(24, '#ffffff')).setOrigin(0.5, 0));
      c.add(this.add.text(SLOT_W / 2, 194, ch.subject, textStyle(18, ch.color)).setOrigin(0.5, 0));
      c.add(this.add.text(12, 220, `Habilidade: ${ch.skill.name}`, textStyle(17, '#ffd23f', { wordWrap: { width: SLOT_W - 20 } })));
      c.add(this.add.text(12, 240, ch.skill.description, textStyle(15, '#e0dcf5', { wordWrap: { width: SLOT_W - 20 } })));
      c.add(this.add.text(12, 286, `Passivo: ${ch.passive.name}`, textStyle(16, '#7be04a', { wordWrap: { width: SLOT_W - 20 } })));
      const canEdit = this.mode === 'local' || s.mine;
      if (canEdit && !s.ready) {
        const l = this.add.text(30, 124, '◀', textStyle(32, '#ffd23f')).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const r = this.add.text(SLOT_W - 30, 124, '▶', textStyle(32, '#ffd23f')).setOrigin(0.5).setInteractive({ useHandCursor: true });
        l.on('pointerdown', () => this.changeChar(this.slotRef(s), -1));
        r.on('pointerdown', () => this.changeChar(this.slotRef(s), 1));
        c.add([l, r]);
      }
      c.add(this.add.text(SLOT_W / 2, SLOT_H - 22, s.ready ? 'PRONTO!' : 'escolhendo...', titleStyle(9, s.ready ? '#5ee05e' : '#a39cc0')).setOrigin(0.5));
      this.slotLayer.add(c);
    }
    const mine = this.mode === 'local' ? slots[0] : slots.find((s) => s.mine);
    this.readyBtn.setLabel(mine?.ready ? 'CANCELAR' : 'PRONTO!');
  }

  slotRef(s) {
    return this.mode === 'local' ? this.slots.find((x) => x.id === s.id) : s;
  }

  // ------------------------------------------------------------------ entrada
  update(_, delta) {
    const k = this.keys;
    if (k.wasPressed('Escape')) { k.endFrame(); return this.back(); }
    if (this.mode === 'local') this.updateLocal(delta);
    else this.updateOnline();
    k.endFrame();
  }

  padPress(pad, name, v) {
    const key = pad.index + name;
    const was = this.prevPad[key];
    this.prevPad[key] = v;
    return v && !was;
  }

  pads() {
    const gp = this.input.gamepad;
    return gp && gp.total ? gp.getAll().filter((p) => p && p.connected) : [];
  }

  updateLocal(delta) {
    const k = this.keys;
    const slotOf = (device) => this.slots.find((s) => s.device === device);
    const p1 = slotOf('kbm');
    if (p1) {
      if (k.wasPressed('KeyA')) this.changeChar(p1, -1);
      if (k.wasPressed('KeyD')) this.changeChar(p1, 1);
      if (k.wasPressed('Space') || k.wasPressed('KeyE')) this.toggleReady(p1);
    }
    const kb2 = slotOf('kb2');
    if (!kb2 && (k.wasPressed('Enter') || k.wasPressed('NumpadEnter'))) this.join('kb2');
    else if (kb2) {
      if (k.wasPressed('ArrowLeft')) this.changeChar(kb2, -1);
      if (k.wasPressed('ArrowRight')) this.changeChar(kb2, 1);
      if (k.wasPressed('Enter') || k.wasPressed('NumpadEnter')) this.toggleReady(kb2);
      if (k.wasPressed('Backspace')) this.leaveSlot(kb2);
    }
    for (const pad of this.pads()) {
      const dev = 'pad' + Math.min(3, pad.index);
      const s = slotOf(dev);
      const a = this.padPress(pad, 'a', !!pad.buttons[0]?.pressed);
      const b = this.padPress(pad, 'b', !!pad.buttons[1]?.pressed);
      const l = this.padPress(pad, 'l', pad.left || pad.leftStick.x < -0.6);
      const r = this.padPress(pad, 'r', pad.right || pad.leftStick.x > 0.6);
      if (!s) { if (a) this.join(dev); continue; }
      if (l) this.changeChar(s, -1);
      if (r) this.changeChar(s, 1);
      if (a) this.toggleReady(s);
      if (b) this.leaveSlot(s);
    }
    // todos prontos -> contagem
    const allReady = this.slots.length >= 2 && this.slots.every((s) => s.ready);
    if (allReady) {
      this.countdown += delta;
      this.msg.setText(`Começando em ${Math.max(0, Math.ceil(2 - this.countdown / 1000))}...`);
      if (this.countdown >= 2000) this.startLocal();
    } else {
      this.countdown = 0;
      if (this.slots.length < 2) this.msg.setText('Falta pelo menos mais 1 jogador (ENTER no teclado ou A no controle)');
      else if (!this.msg.text.startsWith('Esse')) this.msg.setText('');
    }
  }

  join(device) {
    if (this.slots.length >= 4) return;
    const used = new Set(this.slots.map((s) => s.id));
    let n = 1;
    while (used.has('p' + n)) n++;
    const slot = { id: 'p' + n, name: 'Jogador ' + n, device, characterId: null, ready: false };
    slot.characterId = this.nextChar({ ...slot, characterId: this.playable[this.playable.length - 1].id }, 1);
    this.slots.push(slot);
    sound.unlock();
    sound.play('select');
    this.render();
  }

  leaveSlot(s) {
    if (s.device === 'kbm') return;
    this.slots = this.slots.filter((x) => x !== s);
    sound.play('click');
    this.render();
  }

  startLocal() {
    if (this.started) return;
    this.started = true;
    const players = this.slots.map((s) => ({ id: s.id, characterId: s.characterId, name: s.name, device: s.device }));
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { mode: 'local', players }));
  }

  updateOnline() {
    const k = this.keys;
    const mine = this.currentSlots().find((s) => s.mine);
    if (!mine) return;
    if (k.wasPressed('KeyA') || k.wasPressed('ArrowLeft')) this.changeChar(mine, -1);
    if (k.wasPressed('KeyD') || k.wasPressed('ArrowRight')) this.changeChar(mine, 1);
    if (k.wasPressed('Space') || k.wasPressed('Enter') || k.wasPressed('KeyE')) this.toggleReady(mine);
    for (const pad of this.pads()) {
      if (this.padPress(pad, 'l', pad.left || pad.leftStick.x < -0.6)) this.changeChar(mine, -1);
      if (this.padPress(pad, 'r', pad.right || pad.leftStick.x > 0.6)) this.changeChar(mine, 1);
      if (this.padPress(pad, 'a', !!pad.buttons[0]?.pressed)) this.toggleReady(mine);
    }
    const slots = this.currentSlots();
    if (slots.length && slots.every((s) => s.ready)) this.msg.setText('Todos prontos! Começando...');
    else if (slots.length === 1) this.msg.setText('Você pode começar sozinho ou esperar os amigos.');
  }

  startOnline(msg) {
    if (this.started) return;
    this.started = true;
    const session = new OnlineSession(this.data_, this.client, msg);
    this.scene.start('Game', { mode: 'online', session });
  }
}
