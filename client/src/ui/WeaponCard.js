import { COLORS, GAME_W, GAME_H, textStyle } from '../config.js';
import { hexToInt } from '../render/pixel.js';
import { energyCost } from '/shared/sim/armas/Weapons.js';

const W = 228;

/** Card com nome, raridade e atributos de uma arma no chão (aparece quando o jogador chega perto). */
export class WeaponCard {
  constructor(scene, data) {
    this.scene = scene;
    this.data = data;
    this.c = scene.add.container(0, 0).setVisible(false).setDepth(50);
    this.bg = scene.add.graphics();
    this.icon = scene.add.image(20, 22, 'px').setScale(1.5);
    this.title = scene.add.text(42, 6, '', textStyle(20, '#ffffff', { wordWrap: { width: W - 50 } }));
    this.sub = scene.add.text(10, 0, '', textStyle(17, '#cfc8ef'));
    this.body = scene.add.text(10, 0, '', textStyle(18, '#ffffff', { lineSpacing: -2 }));
    this.extra = scene.add.text(10, 0, '', textStyle(17, '#ffd23f', { wordWrap: { width: W - 20 } }));
    this.foot = scene.add.text(W / 2, 0, '', textStyle(18, '#bfffd0')).setOrigin(0.5, 0);
    this.c.add([this.bg, this.icon, this.title, this.sub, this.body, this.extra, this.foot]);
    this.key = null;
  }

  hide() { this.c.setVisible(false); this.key = null; }

  show(weaponId, player, sx, sy) {
    const key = weaponId + '|' + player.weapons.join(',') + '|' + player.cur;
    if (key !== this.key) {
      this.key = key;
      this.build(weaponId, player);
    }
    const h = this.h;
    let x = Math.round(sx - W / 2), y = Math.round(sy - h - 28);
    if (y < 90) y = Math.round(sy + 30);
    x = Math.max(6, Math.min(GAME_W - W - 6, x));
    y = Math.max(6, Math.min(GAME_H - h - 80, y));
    this.c.setPosition(x, y).setVisible(true);
  }

  build(id, player) {
    const d = this.data;
    const w = d.weapon(id);
    const rar = d.rarities[w.rarity];
    const col = rar.color;
    this.icon.setTexture('wpn_' + id);
    this.title.setText(w.name).setColor(col);
    let y = Math.max(40, this.title.y + this.title.height + 2);
    this.sub.setText(`${rar.label} • ${d.categories[w.category] || w.category}`).setY(y);
    y += 20;
    const pr = w.projectile;
    const count = pr && pr.count > 1 ? ` x${pr.count}` : '';
    const cost = energyCost(player, w);
    const lines = [
      `Dano: ${w.damage}${count}`,
      `Cadência: ${w.fireRate}/s`,
      `Energia: ${cost === 0 ? 'grátis' : Number.isInteger(cost) ? cost : cost.toFixed(2)}`,
      `Crítico: ${Math.round(w.critChance * 100)}%`,
      `Imprecisão: ${w.inaccuracy}°`
    ];
    this.body.setText(lines.join('\n')).setY(y);
    y += this.body.height + 2;
    const tags = [];
    if (w.effect) tags.push(`${d.effects[w.effect.type]?.label || w.effect.type}${w.effect.chance < 1 ? ` (${Math.round(w.effect.chance * 100)}%)` : ''}`);
    if (pr?.pierce > 0) tags.push(pr.pierce >= 99 ? 'Atravessa tudo' : `Perfura ${pr.pierce}`);
    if (pr?.bounce > 0) tags.push(`Ricochete ${pr.bounce}`);
    if (pr?.explode) tags.push('Explosão');
    if (pr?.homing) tags.push('Teleguiado');
    if (pr?.boomerang) tags.push('Bumerangue');
    if (w.melee?.reflect) tags.push('Rebate balas');
    else if (w.melee?.deflect) tags.push('Corta balas');
    this.extra.setText(tags.length ? 'Efeito: ' + tags.join(', ') : '').setY(y);
    if (tags.length) y += this.extra.height + 2;
    const full = player.weapons.length >= 2;
    this.foot.setText(full ? `[E] Trocar pela ${d.weapon(player.weapons[player.cur]).name.split(' ')[0]}...` : '[E] Pegar').setY(y + 2);
    if (full) this.foot.setText('[E] Trocar pela arma atual');
    y += 26;
    this.h = y;
    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.4).fillRect(3, 4, W, y);
    g.fillStyle(COLORS.panel, 0.95).fillRect(0, 0, W, y);
    g.fillStyle(hexToInt(col), 1).fillRect(0, 0, W, 3);
    g.lineStyle(2, hexToInt(col), 1).strokeRect(1, 1, W - 2, y - 2);
  }
}
