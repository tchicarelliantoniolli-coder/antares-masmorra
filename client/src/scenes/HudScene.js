import { GAME_W, GAME_H, COLORS, textStyle, titleStyle } from '../config.js';
import { THEME_LABELS } from '/shared/sim/constants.js';
import { energyCost } from '/shared/sim/armas/Weapons.js';
import { hexToInt } from '../render/pixel.js';
import { WeaponCard } from '../ui/WeaponCard.js';
import { drawMinimap } from '../ui/Minimap.js';

const SKILL_ICON = { nota_mil: '1000', equacao: '×5' };

/** HUD: vida/escudo/energia, armas, habilidade, minimapa, barra do chefe, avisos e card de arma. */
export class HudScene extends Phaser.Scene {
  constructor() { super('Hud'); }

  init(params) {
    this.gameScene = params.game;
    this.ready = false;
  }

  create() {
    const data = this.registry.get('data');
    this.data_ = data;
    const world = this.gameScene.world;
    const p = world.getPlayer(this.gameScene.localId);
    const c = data.character(p.charId);

    // painel de status
    this.g = this.add.graphics();
    this.add.image(30, 34, 'char_' + p.charId, 0).setScale(1.6);
    this.add.text(8, 66, c.shortName, textStyle(16, c.color));
    this.add.image(64, 18, 'icon_heart');
    this.add.image(64, 38, 'icon_shield');
    this.add.image(64, 58, 'icon_energy');
    this.hpText = this.add.text(150, 18, '', textStyle(18)).setOrigin(0.5);
    this.shText = this.add.text(150, 38, '', textStyle(18)).setOrigin(0.5);
    this.enText = this.add.text(150, 58, '', textStyle(18)).setOrigin(0.5);
    this.add.image(14, 96, 'icon_coin').setScale(1.4);
    this.coinText = this.add.text(26, 87, '0', textStyle(20, '#f2c94c'));

    // armas
    this.wpIcon = this.add.image(GAME_W - 202, GAME_H - 38, 'px').setScale(2);
    this.wpName = this.add.text(GAME_W - 170, GAME_H - 66, '', textStyle(18, '#ffffff', { wordWrap: { width: 160 }, lineSpacing: -4 }));
    this.wpCost = this.add.text(GAME_W - 170, GAME_H - 28, '', textStyle(17, '#7fb8ff'));
    this.wp2Icon = this.add.image(GAME_W - 265, GAME_H - 36, 'px').setScale(1.2);
    this.wp2Key = this.add.text(GAME_W - 288, GAME_H - 62, 'Q', titleStyle(8, '#ffd23f'));

    // habilidade
    this.skillIcon = this.add.text(GAME_W - 334, GAME_H - 36, SKILL_ICON[p.skillId] || c.skill.name.slice(0, 2), titleStyle(9, '#ffffff')).setOrigin(0.5);
    this.add.text(GAME_W - 334, GAME_H - 8, 'ESPAÇO', textStyle(14, '#a39cc0')).setOrigin(0.5);
    this.skillCdText = this.add.text(GAME_W - 334, GAME_H - 36, '', titleStyle(10, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5);

    // minimapa
    this.mm = this.add.graphics();
    this.floorText = this.add.text(GAME_W - 8, 0, '', textStyle(18, '#cfc8ef')).setOrigin(1, 0);
    this.roomText = this.add.text(GAME_W - 8, 0, '', textStyle(16, '#8a83ad')).setOrigin(1, 0);
    this.mmTimer = 0;

    // chefe
    this.bossG = this.add.graphics();
    this.bossName = this.add.text(GAME_W / 2, 8, '', titleStyle(10, '#ffd0d0', { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5, 0);

    // interação
    this.prompt = this.add.text(GAME_W / 2, GAME_H - 96, '', textStyle(22, '#ffffff', { stroke: '#000', strokeThickness: 4, backgroundColor: '#1d1a2bcc', padding: { x: 8, y: 2 } })).setOrigin(0.5);
    this.card = new WeaponCard(this, data);

    // avisos
    this.bannerTitle = this.add.text(GAME_W / 2, 150, '', titleStyle(20, '#ffd23f', { stroke: '#1b1424', strokeThickness: 8, align: 'center' })).setOrigin(0.5).setAlpha(0);
    this.bannerSub = this.add.text(GAME_W / 2, 182, '', textStyle(24, '#ffffff', { stroke: '#1b1424', strokeThickness: 5, align: 'center' })).setOrigin(0.5).setAlpha(0);
    this.toastText = this.add.text(GAME_W / 2, 110, '', textStyle(24, '#bfffd0', { stroke: '#1b1424', strokeThickness: 5 })).setOrigin(0.5).setAlpha(0);
    this.vignette = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xff0000, 0).setOrigin(0);
    this.lowHp = this.add.graphics();
    this.ready = true;
  }

  flashDamage(shieldOnly) {
    this.vignette.setFillStyle(shieldOnly ? 0x6080ff : 0xff0000, shieldOnly ? 0.12 : 0.25);
    this.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(1);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: 300 });
  }

  banner(title, sub = '', dur = 2200) {
    this.bannerTitle.setText(title);
    this.bannerSub.setText(sub);
    for (const t of [this.bannerTitle, this.bannerSub]) {
      this.tweens.killTweensOf(t);
      t.setAlpha(0).setScale(0.8);
      this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 250, ease: 'Back.out' });
      this.tweens.add({ targets: t, alpha: 0, delay: dur, duration: 400 });
    }
  }

  bossIntro(name, title) {
    this.banner(name.toUpperCase(), title, 2600);
    const top = this.add.rectangle(0, -40, GAME_W, 40, 0x000000).setOrigin(0);
    const bot = this.add.rectangle(0, GAME_H, GAME_W, 40, 0x000000).setOrigin(0);
    this.tweens.add({ targets: top, y: 0, duration: 300, yoyo: true, hold: 1800, onComplete: () => top.destroy() });
    this.tweens.add({ targets: bot, y: GAME_H - 40, duration: 300, yoyo: true, hold: 1800, onComplete: () => bot.destroy() });
  }

  toast(text) {
    this.toastText.setText(text);
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setAlpha(1).setY(110);
    this.tweens.add({ targets: this.toastText, alpha: 0, y: 96, delay: 900, duration: 500 });
  }

  update(time, delta) {
    if (!this.ready) return;
    const gs = this.gameScene;
    const world = gs.world;
    const data = this.data_;
    const p = world.getPlayer(gs.localId);
    if (!p) return;
    const g = this.g;
    g.clear();

    // ---- painel de status
    g.fillStyle(0x000000, 0.35).fillRect(5, 5, 232, 78);
    g.fillStyle(COLORS.panel, 0.88).fillRect(2, 2, 232, 78);
    g.lineStyle(2, COLORS.border, 1).strokeRect(3, 3, 230, 76);
    const bar = (y, val, max, color) => {
      g.fillStyle(0x0d0b14, 1).fillRect(76, y - 7, 150, 14);
      g.fillStyle(color, 1).fillRect(76, y - 7, Math.round(150 * Math.max(0, val) / max), 14);
      g.fillStyle(0xffffff, 0.18).fillRect(76, y - 7, Math.round(150 * Math.max(0, val) / max), 3);
      g.lineStyle(1, 0x000000, 1).strokeRect(76, y - 7, 150, 14);
    };
    bar(18, p.hp, p.maxHp, COLORS.hp);
    bar(38, p.shield, p.maxShield, COLORS.shield);
    bar(58, p.energy, p.maxEnergy, COLORS.energy);
    this.hpText.setText(`${p.hp}/${p.maxHp}`);
    this.shText.setText(`${p.shield}/${p.maxShield}`);
    this.enText.setText(`${Math.floor(p.energy)}/${p.maxEnergy}`);
    this.coinText.setText(String(p.coins));

    // ---- armas
    const w1 = data.weapon(p.weapons[p.cur]);
    const rcol = data.rarities[w1.rarity].color;
    g.fillStyle(0x000000, 0.35).fillRect(GAME_W - 232, GAME_H - 70, 228, 66);
    g.fillStyle(COLORS.panel, 0.9).fillRect(GAME_W - 234, GAME_H - 72, 228, 66);
    g.lineStyle(2, hexToInt(rcol), 1).strokeRect(GAME_W - 233, GAME_H - 71, 226, 64);
    this.wpIcon.setTexture('wpn_' + w1.id);
    this.wpName.setText(w1.name).setColor(rcol);
    const cost = energyCost(p, w1);
    this.wpCost.setText(cost > 0 ? `Energia: ${Number.isInteger(cost) ? cost : cost.toFixed(2)}` : 'Energia: grátis');
    if (p.weapons.length > 1) {
      const w2 = data.weapon(p.weapons[(p.cur + 1) % p.weapons.length]);
      g.fillStyle(COLORS.panel, 0.85).fillRect(GAME_W - 294, GAME_H - 62, 56, 50);
      g.lineStyle(2, hexToInt(data.rarities[w2.rarity].color), 0.8).strokeRect(GAME_W - 293, GAME_H - 61, 54, 48);
      this.wp2Icon.setVisible(true).setTexture('wpn_' + w2.id);
      this.wp2Key.setVisible(true);
    } else {
      this.wp2Icon.setVisible(false);
      this.wp2Key.setVisible(false);
    }

    // ---- habilidade
    const sx = GAME_W - 334, sy = GAME_H - 36;
    const ready = p.skillCd <= 0;
    g.fillStyle(0x000000, 0.4).fillCircle(sx + 2, sy + 3, 24);
    g.fillStyle(ready ? 0x6b4fd8 : 0x2a2540, 1).fillCircle(sx, sy, 24);
    if (!ready) {
      const frac = p.skillCd / (p.skillCooldown * p.mods.skillCdMul);
      g.fillStyle(0x0d0b14, 0.75);
      g.slice(sx, sy, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false).fillPath();
      this.skillCdText.setText(Math.ceil(p.skillCd).toString());
      this.skillIcon.setAlpha(0.35);
    } else {
      this.skillCdText.setText('');
      this.skillIcon.setAlpha(1);
    }
    g.lineStyle(2, ready ? COLORS.gold : COLORS.border, 1).strokeCircle(sx, sy, 24);

    // ---- minimapa (redesenha algumas vezes por segundo)
    this.mmTimer -= delta;
    if (this.mmTimer <= 0) {
      this.mmTimer = 120;
      const box = drawMinimap(this.mm, world, p, GAME_W - 8, 8, time);
      this.floorText.setY(box.bottom + 4).setText(`Andar ${world.floorNum} — ${world.floorDef.name}`);
      const room = world.rooms[p.roomId];
      this.roomText.setY(box.bottom + 22).setText(room ? (room.type === 'boss' ? world.floorDef.bossRoomName : THEME_LABELS[room.theme] || '') : 'Corredor');
    }

    // ---- chefe
    this.bossG.clear();
    const b = world.boss;
    if (b && !b.dead && b.spawning <= 0) {
      const bw = 420, bx = (GAME_W - bw) / 2, by = 28;
      this.bossName.setText(b.def.name + (b.phase2 ? '  (FASE 2)' : ''));
      this.bossG.fillStyle(0x000000, 0.6).fillRect(bx - 3, by - 3, bw + 6, 18);
      this.bossG.fillStyle(0x5a1a1a, 1).fillRect(bx, by, bw, 12);
      this.bossG.fillStyle(b.phase2 ? 0xff5a2a : 0xe04848, 1).fillRect(bx, by, Math.round((bw * b.hp) / b.maxHp), 12);
      this.bossG.fillStyle(0xffffff, 0.2).fillRect(bx, by, Math.round((bw * b.hp) / b.maxHp), 3);
      this.bossG.fillStyle(0xffd23f, 1).fillRect(bx + bw / 2 - 1, by - 2, 2, 16);
    } else {
      this.bossName.setText('');
    }

    // ---- interação e card da arma
    const tgt = p.downed ? null : p.interactTarget;
    const cam = gs.cameras.main;
    if (tgt && tgt.kind === 'weapon') {
      this.prompt.setText('');
      const sxw = tgt.x - cam.worldView.x, syw = tgt.y - cam.worldView.y;
      this.card.show(tgt.weaponId, p, sxw, syw);
    } else {
      this.card.hide();
      let msg = '';
      if (tgt?.kind === 'chest') msg = '[E] Abrir o baú';
      else if (tgt?.kind === 'heal_station') msg = '[E] Enfermaria: curar o time';
      else if (tgt?.kind === 'portal') msg = world.floorNum >= world.maxFloors ? '[E] Entrar no portal (concluir o andar)' : '[E] Entrar no portal (próximo andar)';
      else if (p.downed) msg = world.players.length > 1 ? 'Caído! Um colega precisa ficar perto de você por 3 s' : '';
      this.prompt.setText(msg).setVisible(!!msg);
    }

    // ---- aviso de vida baixa
    this.lowHp.clear();
    if (!p.downed && p.hp <= 2 && p.shield === 0) {
      const a = 0.18 + Math.sin(time / 180) * 0.1;
      this.lowHp.lineStyle(14, 0xff0000, a).strokeRect(0, 0, GAME_W, GAME_H);
    }
  }
}

