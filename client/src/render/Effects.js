import { sound } from '../audio/Sound.js';
import { textStyle } from '../config.js';

const DEPTH = 9600;

/**
 * Transforma os eventos da simulação em sons, partículas, números de dano e tremidas de câmera.
 */
export class Effects {
  constructor(scene, renderer, localId) {
    this.scene = scene;
    this.renderer = renderer;
    this.localId = localId;
    this.emitters = new Map();
    this.textPool = [];
  }

  emitter(color) {
    let e = this.emitters.get(color);
    if (!e) {
      e = this.scene.add.particles(0, 0, 'px', {
        speed: { min: 40, max: 160 },
        lifespan: { min: 250, max: 550 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0.2 },
        tint: color,
        gravityY: 120,
        emitting: false
      }).setDepth(DEPTH);
      this.emitters.set(color, e);
    }
    return e;
  }

  burst(x, y, color, n = 10) {
    this.emitter(color).explode(n, x, y);
  }

  floatText(x, y, text, color = '#ffffff', size = 22, dur = 650) {
    let t = this.textPool.pop();
    if (!t) t = this.scene.add.text(0, 0, '', textStyle(size, color, { stroke: '#1b1424', strokeThickness: 4 })).setOrigin(0.5);
    t.setText(text).setColor(color).setFontSize(size).setPosition(x + (Math.random() - 0.5) * 10, y).setAlpha(1).setScale(1).setDepth(DEPTH + 10).setVisible(true);
    this.scene.tweens.add({
      targets: t, y: y - 26, alpha: 0, duration: dur, ease: 'Cubic.out',
      onComplete: () => { t.setVisible(false); this.textPool.push(t); }
    });
  }

  ring(x, y, radius, color, dur = 350, alpha = 0.8) {
    const img = this.scene.add.image(x, y, 'soft').setTint(color).setAlpha(alpha).setScale(0.1).setDepth(DEPTH - 5).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: img, scale: radius / 28, alpha: 0, duration: dur, ease: 'Cubic.out', onComplete: () => img.destroy() });
  }

  slash(ev) {
    const g = this.scene.add.graphics().setDepth(DEPTH - 1);
    const a0 = ev.angle - (ev.arc * Math.PI) / 360, a1 = ev.angle + (ev.arc * Math.PI) / 360;
    g.lineStyle(6, 0xffffff, 0.85);
    g.beginPath();
    g.arc(ev.x, ev.y - 6, ev.range * 0.85, a0, a1);
    g.strokePath();
    g.lineStyle(2, 0xbfe9ff, 1);
    g.beginPath();
    g.arc(ev.x, ev.y - 6, ev.range, a0, a1);
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  lightning(points) {
    const g = this.scene.add.graphics().setDepth(DEPTH);
    for (const [w, col] of [[4, 0x2a8fd8], [2, 0xbff8ff]]) {
      g.lineStyle(w, col, 1);
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1], [x1, y1] = points[i];
        for (let k = 1; k <= 4; k++) {
          const t = k / 4;
          const j = k === 4 ? 0 : (Math.random() - 0.5) * 14;
          g.lineTo(x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t + j);
        }
      }
      g.strokePath();
    }
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  shake(ms = 100, intensity = 0.004) {
    this.scene.cameras.main.shake(ms, intensity);
  }

  handle(events, hud) {
    for (const ev of events) {
      switch (ev.type) {
        case 'shoot': {
          this.renderer.onShoot(ev);
          if (ev.wtype === 'melee') break;
          const cat = ev.category;
          if (ev.weaponId === 'lanca_misseis_giz' || ev.weaponId === 'escopeta_clipes') sound.play('shoot_heavy', 0.05);
          else if (cat === 'magica') sound.play('shoot_magic', 0.06);
          else if (cat === 'arremesso' || cat === 'inicial') sound.play('shoot_throw', 0.05);
          else sound.play('shoot', 0.04);
          if (ev.weaponId === 'escopeta_clipes' || ev.weaponId === 'lanca_misseis_giz') this.shake(60, 0.003);
          break;
        }
        case 'swing': this.renderer.onSwing(ev); this.slash(ev); sound.play('swing'); break;
        case 'dmg':
          if (ev.target === 'enemy') {
            this.floatText(ev.x, ev.y, ev.crit ? ev.amount + '!' : String(ev.amount), ev.crit ? '#ffb02e' : '#ffffff', ev.crit ? 28 : 22);
            sound.play(ev.crit ? 'crit' : 'hit', 0.03);
          }
          break;
        case 'enemy_die':
          this.burst(ev.x, ev.y, ev.enemyType === 'caderno_zumbi' ? 0x6fbf63 : ev.enemyType === 'estojo' ? 0x5a8ff0 : 0xfbfbf3, ev.boss ? 60 : 14);
          this.burst(ev.x, ev.y, 0xffffff, ev.boss ? 40 : 6);
          sound.play(ev.boss ? 'explosion' : 'enemy_die', 0.03);
          if (ev.boss) { this.shake(600, 0.012); this.ring(ev.x, ev.y, 160, 0xffffff, 700); }
          break;
        case 'enemy_spawn': if (!ev.boss) sound.play('spawn', 0.08); break;
        case 'enemy_shoot': sound.play('enemy_shoot', 0.05); break;
        case 'proj_hit':
          this.burst(ev.x, ev.y, ev.team === 'enemy' ? 0xff3d6e : 0xffffff, 4);
          break;
        case 'explosion':
          this.ring(ev.x, ev.y, ev.radius, ev.style === 'acid' ? 0x7be04a : 0xfff4d6, 380, 0.9);
          this.burst(ev.x, ev.y, ev.style === 'acid' ? 0x7be04a : 0xffffff, 18);
          sound.play(ev.style === 'acid' ? 'splash' : 'explosion', 0.05);
          this.shake(120, ev.style === 'acid' ? 0.002 : 0.006);
          break;
        case 'chain': this.lightning(ev.points); sound.play('shock', 0.06); break;
        case 'bounce': sound.play('bounce', 0.05); break;
        case 'deflect': this.burst(ev.x, ev.y, 0xbfe9ff, 6); sound.play('deflect', 0.03); break;
        case 'reflect': this.burst(ev.x, ev.y, 0x9fffd0, 8); sound.play('deflect', 0.03); break;
        case 'player_hit':
          this.renderer.onPlayerHit(ev);
          if (ev.id === this.localId) {
            sound.play(ev.shieldOnly ? 'shield_hit' : 'player_hurt');
            this.shake(140, ev.shieldOnly ? 0.004 : 0.008);
            hud?.flashDamage(ev.shieldOnly);
          }
          this.floatText(ev.x, ev.y - 26, '-' + ev.amount, ev.shieldOnly ? '#bcd0ff' : '#ff5a5a', 22);
          break;
        case 'player_down': sound.play('down'); this.shake(300, 0.01); this.burst(ev.x, ev.y, 0xe04848, 20); break;
        case 'player_revive': sound.play('revive'); this.ring(ev.x, ev.y, 60, 0x5ee05e, 500); break;
        case 'pickup':
          if (ev.what === 'coin') sound.play('coin', 0.03);
          else if (ev.what === 'energy') sound.play('energy', 0.03);
          else { sound.play('apple'); this.floatText(ev.x, ev.y - 10, '+2', '#ff8a8a'); }
          break;
        case 'weapon_pickup': sound.play('weapon'); break;
        case 'weapon_swap': sound.play('swap'); break;
        case 'chest_open': sound.play('chest'); this.burst(ev.x, ev.y - 6, 0xf2c94c, 24); this.ring(ev.x, ev.y, 50, 0xfff2a8, 500); break;
        case 'heal': sound.play('heal'); this.ring(ev.x, ev.y, 120, 0x5ee05e, 700); this.burst(ev.x, ev.y, 0x5ee05e, 30); hud?.banner('Todos curados!', 'Enfermaria'); break;
        case 'room_lock': sound.play('door_close'); this.shake(120, 0.004); break;
        case 'room_clear': sound.play('door_open'); hud?.toast('Sala liberada!'); break;
        case 'wave_start': if (ev.wave > 1) hud?.toast(`Onda ${ev.wave}/${ev.total}`); break;
        case 'no_energy': if (ev.playerId === this.localId) { sound.play('no_energy', 0.3); this.floatText(ev.x, ev.y - 30, 'Sem energia!', '#7fb8ff', 20); } break;
        case 'skill_not_ready': if (ev.playerId === this.localId) sound.play('not_ready', 0.2); break;
        case 'skill':
          sound.play('skill');
          if (ev.skill === 'nota_mil') { this.shake(200, 0.006); this.floatText(ev.x, ev.y - 34, 'NOTA MIL!', '#ff4d4d', 28, 900); }
          if (ev.skill === 'equacao') { sound.play('equation'); this.floatText(ev.x, ev.y - 34, 'x = 5', '#ffd23f', 28, 900); this.ring(ev.x, ev.y, 50, 0xffd23f, 400); }
          break;
        case 'equation_hit':
          sound.play('big_hit');
          this.floatText(ev.x, ev.y - 8, '×' + ev.mul + '!', '#ffd23f', 34, 900);
          this.shake(160, 0.008);
          break;
        case 'toner_splash': sound.play('splash', 0.05); this.burst(ev.x, ev.y, 0x4a2a6a, 14); break;
        case 'boss_intro':
          sound.play('boss_roar');
          sound.playMusic('boss');
          hud?.bossIntro(ev.name, ev.title);
          break;
        case 'boss_phase':
          sound.play('boss_roar');
          this.shake(500, 0.01);
          hud?.banner(ev.text || 'FASE 2!', ev.name);
          break;
        case 'boss_dash': sound.play('boss_dash'); break;
        case 'boss_crash': sound.play('crash'); this.shake(300, 0.012); this.burst(ev.x, ev.y, 0xfbfbf3, 24); break;
        case 'boss_throw': sound.play('shoot_throw'); break;
        case 'boss_defeated':
          sound.playMusic('dungeon');
          hud?.banner('CHEFE DERROTADO!', 'O portal para o próximo andar foi aberto');
          break;
        case 'portal_enter': sound.play('portal'); break;
        case 'teleport': this.ring(ev.x, ev.y, 30, 0xc86bff, 300); break;
        default: break;
      }
    }
  }
}
