import { GAME_W, GAME_H, COLORS, textStyle, titleStyle } from '../config.js';
import { THEME_LABELS, REVIVE_RADIUS } from '/shared/sim/constants.js';
import { energyText } from '/shared/sim/armas/Weapons.js';
import { BLESSINGS } from '/shared/sim/salas/Pickups.js';
import { hexToInt } from '../render/pixel.js';
import { WeaponCard } from '../ui/WeaponCard.js';
import { drawMinimap } from '../ui/Minimap.js';

const SKILL_ICON = {
  nota_mil: '1000', equacao: '×5', pique: 'PIQ', campo_gravitacional: 'G', planta_carnivora: 'PLT', grammar_shield: 'ABC',
  translate: '?', circuito: 'ON', terremoto: 'TER', obra_prima: 'ART',
  exercito_historico: 'EXÉ', linha_do_tempo: 'REW', reacao_em_cadeia: 'BOOM', classicos_vivos: 'LIV'
};
const QUAKE_LABEL = { terremoto: 'TER', vulcao: 'VUL' }; // William alterna a cada uso
const DEVICE_KEYS = {
  auto: { interact: 'E' }, kbm: { interact: 'E' }, kb2: { interact: '.' },
  pad0: { interact: 'A' }, pad1: { interact: 'A' }, pad2: { interact: 'A' }, pad3: { interact: 'A' }
};

/**
 * HUD. Com 1 jogador local: painel completo (vida/escudo/energia, 2 armas, habilidade) + painéis menores
 * dos colegas (online). Com vários jogadores locais (co-op): um painel compacto para cada um.
 * Sempre: minimapa, barra do chefe, avisos, card de arma e mensagens de interação.
 */
export class HudScene extends Phaser.Scene {
  constructor() { super('Hud'); }

  init(params) {
    this.gameScene = params.game;
    this.ready = false;
  }

  create() {
    const data = this.registry.get('data');
    this.data_ = data;
    const gs = this.gameScene;
    this.localIds = gs.localIds;
    this.multiLocal = this.localIds.length > 1;
    const world = gs.world;
    this.g = this.add.graphics();
    this.texts = [];

    this.full = false;
    this.compact = new Map(); // id do jogador -> objetos do painel compacto

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
    this.headPrompts = new Map();
    this.cards = new Map(this.localIds.map((id) => [id, new WeaponCard(this, data)]));

    // avisos
    this.bannerTitle = this.add.text(GAME_W / 2, 150, '', titleStyle(20, '#ffd23f', { stroke: '#1b1424', strokeThickness: 8, align: 'center' })).setOrigin(0.5).setAlpha(0);
    this.bannerSub = this.add.text(GAME_W / 2, 182, '', textStyle(24, '#ffffff', { stroke: '#1b1424', strokeThickness: 5, align: 'center' })).setOrigin(0.5).setAlpha(0);
    this.toastText = this.add.text(GAME_W / 2, 110, '', textStyle(24, '#bfffd0', { stroke: '#1b1424', strokeThickness: 5 })).setOrigin(0.5).setAlpha(0);
    this.vignette = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xff0000, 0).setOrigin(0);
    this.lowHp = this.add.graphics();
    if (gs.mode === 'online') {
      this.netText = this.add.text(8, GAME_H - 20, '', textStyle(16, '#8a83ad'));
    }
    this.autoFireText = this.add.text(8, GAME_H - 42, '', textStyle(16, '#ffd23f', { stroke: '#000', strokeThickness: 3 }));
    this.ready = true;
  }

  // ------------------------------------------------------------------ painel completo (1 jogador local)
  buildFullPanel(p) {
    const c = this.data_.character(p.charId);
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
    this.blessText = this.add.text(60, 87, '', textStyle(16, '#ffd23f'));

    this.wpIcon = this.add.image(GAME_W - 202, GAME_H - 38, 'px').setScale(2);
    this.wpName = this.add.text(GAME_W - 170, GAME_H - 66, '', textStyle(18, '#ffffff', { wordWrap: { width: 160 }, lineSpacing: -4 }));
    this.wpCost = this.add.text(GAME_W - 170, GAME_H - 28, '', textStyle(17, '#7fb8ff'));
    this.wp2Icon = this.add.image(GAME_W - 265, GAME_H - 36, 'px').setScale(1.2);
    this.wp2Key = this.add.text(GAME_W - 288, GAME_H - 62, 'Q', titleStyle(8, '#ffd23f'));

    this.skillIcon = this.add.text(GAME_W - 334, GAME_H - 36, SKILL_ICON[p.skillId] || c.skill.name.slice(0, 2), titleStyle(9, '#ffffff')).setOrigin(0.5);
    this.add.text(GAME_W - 334, GAME_H - 8, 'ESPAÇO', textStyle(14, '#a39cc0')).setOrigin(0.5);
    this.skillCdText = this.add.text(GAME_W - 334, GAME_H - 36, '', titleStyle(10, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5);
    this.full = true;
  }

  // ------------------------------------------------------------------ painel compacto
  compactPanel(p, x, y) {
    let o = this.compact.get(p.id);
    if (!o) {
      const c = this.data_.character(p.charId);
      o = {
        portrait: this.add.image(x + 18, y + 22, 'char_' + p.charId, 0).setScale(1.1),
        name: this.add.text(x + 38, y + 2, p.name, textStyle(16, c.color)),
        wp: this.add.image(x + 190, y + 34, 'px'),
        skill: this.add.text(x + 190, y + 12, SKILL_ICON[p.skillId] || '', titleStyle(6, '#ffffff')).setOrigin(0.5),
        status: this.add.text(x + 38, y + 40, '', textStyle(14, '#ff8a8a')),
        coins: this.add.text(x + 150, y + 2, '', textStyle(16, '#f2c94c')),
        x, y
      };
      this.compact.set(p.id, o);
    }
    const g = this.g;
    const { x: px0, y: py0 } = o;
    g.fillStyle(0x000000, 0.35).fillRect(px0 + 3, py0 + 3, 220, 56);
    g.fillStyle(COLORS.panel, 0.85).fillRect(px0, py0, 220, 56);
    g.lineStyle(2, this.localIds.includes(p.id) ? COLORS.gold : COLORS.border, 1).strokeRect(px0 + 1, py0 + 1, 218, 54);
    const bar = (yy, val, max, color) => {
      g.fillStyle(0x0d0b14, 1).fillRect(px0 + 38, py0 + yy, 120, 6);
      g.fillStyle(color, 1).fillRect(px0 + 38, py0 + yy, Math.round(120 * Math.max(0, val) / max), 6);
    };
    bar(20, p.hp, p.maxHp, COLORS.hp);
    bar(28, p.shield, p.maxShield, COLORS.shield);
    bar(36, p.energy, p.maxEnergy, COLORS.energy);
    o.portrait.setTint(p.downed || p.dead ? 0x666688 : 0xffffff);
    o.wp.setTexture('wpn_' + p.weapons[p.cur]);
    o.coins.setText(p.coins + '●');
    o.status.setText(p.dead ? 'saiu' : p.downed ? 'CAÍDO' : p.jailTimer > 0 ? 'SUSPENSO' : p.signing > 0 ? 'assinando' : '');
    // habilidade
    const sx = px0 + 190, sy = py0 + 12;
    const readyS = p.skillCd <= 0;
    g.fillStyle(readyS ? 0x6b4fd8 : 0x2a2540, 1).fillCircle(sx, sy, 10);
    if (!readyS) {
      const frac = p.skillCd / (p.skillCooldown * (p.mods.skillCdMul || 1));
      g.fillStyle(0x0d0b14, 0.75);
      g.slice(sx, sy, 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false).fillPath();
    }
    g.lineStyle(1, readyS ? COLORS.gold : COLORS.border, 1).strokeCircle(sx, sy, 10);
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
    this.tweens.add({ targets: this.toastText, alpha: 0, y: 96, delay: 1100, duration: 500 });
  }

  promptFor(world, p, tgt, key) {
    if (!tgt) return '';
    const k = `[${key}]`;
    switch (tgt.kind) {
      case 'chest': return `${k} Abrir o baú`;
      case 'heal_station': return `${k} Enfermaria: curar o time`;
      case 'portal': return world.floorNum >= world.maxFloors ? `${k} Entrar no portal (vencer!)` : `${k} Portal para o Andar ${world.floorNum + 1}`;
      case 'shop_item': {
        const name = tgt.item === 'weapon' ? this.data_.weapon(tgt.weaponId).name : tgt.item === 'apple' ? 'Maçã (+3 vida)' : tgt.item === 'suco' ? 'Suco (+90 energia)' : 'Broche (+1 escudo máx.)';
        return `${k} Comprar ${name} por ${tgt.price} moedas (você tem ${p.coins})`;
      }
      case 'statue': return `${k} ${BLESSINGS[tgt.blessing]?.name}: ${BLESSINGS[tgt.blessing]?.desc} — ${tgt.price} moedas`;
      default: return '';
    }
  }

  update(time, delta) {
    if (!this.ready) return;
    this.autoFireText.setText(this.gameScene.controllers.some(({ ctrl }) => ctrl.autoFire) ? 'TIRO AUTOMÁTICO: LIGADO • Enter para desligar' : '');
    const gs = this.gameScene;
    const world = gs.world;
    const data = this.data_;
    const g = this.g;
    g.clear();
    const me = world.getPlayer(this.localIds[0]);
    if (!me) return;
    if (!this.multiLocal && !this.full) this.buildFullPanel(me); // online: espera o 1º estado do servidor

    // ---- painéis
    if (this.full) {
      this.drawFull(me, time);
      let i = 0;
      for (const p of world.players) {
        if (p.id === me.id) continue;
        this.compactPanel(p, 4, 112 + i * 62);
        i++;
      }
    } else {
      const pos = [[4, 4], [230, 4], [4, GAME_H - 64], [230, GAME_H - 64]];
      world.players.forEach((p, i) => this.compactPanel(p, pos[i % 4][0], pos[i % 4][1]));
    }

    // ---- minimapa
    this.mmTimer -= delta;
    if (this.mmTimer <= 0) {
      this.mmTimer = 120;
      const box = drawMinimap(this.mm, world, me, GAME_W - 8, 8, time);
      this.floorText.setY(box.bottom + 4).setText(`Andar ${world.floorNum}/${world.maxFloors} — ${world.floorDef.name}`);
      const room = world.rooms[me.roomId];
      this.roomText.setY(box.bottom + 22).setText(room ? (room.type === 'boss' ? world.floorDef.bossRoomName : room.type === 'shop' ? 'Cantina' : THEME_LABELS[room.theme] || '') : 'Corredor');
    }

    // ---- chefe
    this.bossG.clear();
    const b = world.boss;
    if (b && !b.dead && b.spawning <= 0) {
      const bw = 420, bx = (GAME_W - bw) / 2, by = this.multiLocal ? 84 : 28;
      this.bossName.setY(by - 20);
      const phases = b.type === 'samara' ? 3 : 2;
      const phase = b.phase || (b.phase2 ? 2 : 1);
      this.bossName.setText(b.def.name + (phase > 1 ? `  (FASE ${phase})` : ''));
      this.bossG.fillStyle(0x000000, 0.6).fillRect(bx - 3, by - 3, bw + 6, 18);
      this.bossG.fillStyle(0x5a1a1a, 1).fillRect(bx, by, bw, 12);
      this.bossG.fillStyle(phase > 1 ? 0xff5a2a : 0xe04848, 1).fillRect(bx, by, Math.round((bw * Math.max(0, b.hp)) / b.maxHp), 12);
      this.bossG.fillStyle(0xffffff, 0.2).fillRect(bx, by, Math.round((bw * Math.max(0, b.hp)) / b.maxHp), 3);
      for (let k = 1; k < phases; k++) this.bossG.fillStyle(0xffd23f, 1).fillRect(bx + (bw * k) / phases - 1, by - 2, 2, 16);
    } else {
      this.bossName.setText('');
    }

    // ---- interação e card da arma
    const cam = gs.cameras.main;
    const toScreen = (x, y) => [(x - cam.worldView.x) * cam.zoom, (y - cam.worldView.y) * cam.zoom];
    let bottomMsg = '';
    const seenHead = new Set();
    for (const id of this.localIds) {
      const p = world.getPlayer(id);
      const card = this.cards.get(id);
      if (!p || p.dead) { card.hide(); continue; }
      const tgt = p.downed || p.jailTimer > 0 || p.signing > 0 ? null : p.interactTarget;
      const dev = gs.localDevices.find((d) => d.id === id)?.device || 'auto';
      const key = DEVICE_KEYS[dev]?.interact || 'E';
      if (tgt && tgt.kind === 'weapon') {
        const [sx, sy] = toScreen(tgt.x, tgt.y);
        card.show(tgt.weaponId, p, sx, sy, key);
        continue;
      }
      card.hide();
      let msg = this.promptFor(world, p, tgt, key);
      if (!msg && p.downed && world.players.length > 1) msg = 'Caído! Um colega precisa ficar parado e sem atirar perto de você por 5 s';
      if (!msg && !p.downed) {
        const fallen = world.players.find((q) => q !== p && q.downed && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < REVIVE_RADIUS);
        if (fallen) msg = `Fique parado e sem atirar para levantar ${fallen.name}`;
      }
      if (!msg && p.signing > 0 && world.players.length > 1) msg = 'Assinando! Um colega perto te liberta';
      if (this.multiLocal) {
        if (!msg) continue;
        seenHead.add(id);
        let t = this.headPrompts.get(id);
        if (!t) { t = this.add.text(0, 0, '', textStyle(18, '#ffffff', { stroke: '#000', strokeThickness: 4 })).setOrigin(0.5, 1); this.headPrompts.set(id, t); }
        const [sx, sy] = toScreen(p.x, p.y - 40);
        t.setText(msg).setPosition(Math.max(150, Math.min(GAME_W - 150, sx)), Math.max(30, sy)).setVisible(true);
      } else bottomMsg = msg;
    }
    for (const [id, t] of this.headPrompts) if (!seenHead.has(id)) t.setVisible(false);
    this.prompt.setText(bottomMsg).setVisible(!!bottomMsg);

    // ---- vida baixa
    this.lowHp.clear();
    const lowAny = this.localIds.map((id) => world.getPlayer(id)).some((p) => p && !p.downed && !p.dead && p.hp <= 2 && p.shield === 0);
    if (lowAny) {
      const a = 0.18 + Math.sin(time / 180) * 0.1;
      this.lowHp.lineStyle(14, 0xff0000, a).strokeRect(0, 0, GAME_W, GAME_H);
    }
    if (this.netText) this.netText.setText(gs.session.disconnected ? 'Conexão perdida com o servidor' : `Sala ${gs.session.client.code || ''}`);
  }

  drawFull(p, time) {
    const data = this.data_;
    const g = this.g;
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
    this.blessText.setText((p.blessings || []).map((b) => BLESSINGS[b]?.desc).filter(Boolean).join(' • '));

    const w1 = data.weapon(p.weapons[p.cur]);
    const rcol = data.rarities[w1.rarity].color;
    g.fillStyle(0x000000, 0.35).fillRect(GAME_W - 232, GAME_H - 70, 228, 66);
    g.fillStyle(COLORS.panel, 0.9).fillRect(GAME_W - 234, GAME_H - 72, 228, 66);
    g.lineStyle(2, hexToInt(rcol), 1).strokeRect(GAME_W - 233, GAME_H - 71, 226, 64);
    this.wpIcon.setTexture('wpn_' + w1.id);
    this.wpName.setText(w1.name).setColor(rcol);
    this.wpCost.setText(`Energia: ${energyText(p, w1)}`);
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

    // William: o ícone mostra qual é o próximo (online usa o padrão até o snapshot trazer buffs.quakeNext)
    if (p.skillId === 'terremoto') this.skillIcon.setText(QUAKE_LABEL[p.buffs?.quakeNext] || 'TER');
    const sx = GAME_W - 334, sy = GAME_H - 36;
    const ready = p.skillCd <= 0;
    g.fillStyle(0x000000, 0.4).fillCircle(sx + 2, sy + 3, 24);
    g.fillStyle(ready ? 0x6b4fd8 : 0x2a2540, 1).fillCircle(sx, sy, 24);
    if (!ready) {
      const frac = p.skillCd / (p.skillCooldown * (p.mods.skillCdMul || 1));
      g.fillStyle(0x0d0b14, 0.75);
      g.slice(sx, sy, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false).fillPath();
      this.skillCdText.setText(Math.ceil(p.skillCd).toString());
      this.skillIcon.setAlpha(0.35);
    } else {
      this.skillCdText.setText('');
      this.skillIcon.setAlpha(1);
    }
    g.lineStyle(2, ready ? COLORS.gold : COLORS.border, 1).strokeCircle(sx, sy, 24);
  }
}
