import { TILE, T, REVIVE_TIME } from '/shared/sim/constants.js';
import { trapState } from '/shared/sim/salas/Props.js';
import { BLESSINGS } from '/shared/sim/salas/Pickups.js';
import { TILESET_COLS, TILE_KIND } from './tileArt.js';
import { hexToInt } from './pixel.js';
import { textStyle } from '../config.js';

const DEPTH_GROUND_FX = 2;
const DEPTH_TRAPS = 1;
const DEPTH_PROJ = 9000;
const DEPTH_FX = 9500;

const ITEM_ICON = { apple: 'apple', suco: 'energy', broche: 'icon_shield' };
const POOL_COLORS = { paint: 0xe04ad0, acid: 0x7be04a, fire: 0xff7a2a, ice: 0x8fe3ff };

/**
 * Desenha o estado da simulação com Phaser. Não decide nada de jogo: só lê o "world"
 * (o mundo local no solo/co-op, ou o espelho montado a partir do servidor no online).
 */
export class WorldRenderer {
  constructor(scene, world, data, localIds) {
    this.scene = scene;
    this.world = world;
    this.data = data;
    this.localIds = new Set(localIds);
    this.views = new Map();
    this.groundFx = scene.add.graphics().setDepth(DEPTH_GROUND_FX);
    this.fx = scene.add.graphics().setDepth(DEPTH_FX);
    this.buildMap();
  }

  buildMap() {
    const { map, rooms } = this.world;
    this.clearMapObjects();
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    const rows = [];
    for (let y = 0; y < map.h; y++) {
      const row = [];
      for (let x = 0; x < map.w; x++) row.push(this.tileIndex(map, x, y));
      rows.push(row);
    }
    this.tilemap = this.scene.make.tilemap({ data: rows, tileWidth: TILE, tileHeight: TILE });
    const ts = this.tilemap.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    this.layer = this.tilemap.createLayer(0, ts, 0, 0).setDepth(0);
    this.mapObjects = [];

    // Portas (grades que sobem quando a sala tranca)
    this.doors = [];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = map.idx(x, y);
        if (map.tiles[i] !== T.DOOR) continue;
        const s = this.scene.add.image((x + 0.5) * TILE, (y + 0.5) * TILE, 'door_bar').setDepth((y + 1) * TILE).setVisible(false);
        this.doors.push({ sprite: s, owner: map.owner[i], shown: false });
      }
    }
    // Caixas e barris
    this.props = new Map();
    for (const [idx, p] of map.props) {
      const tx = idx % map.w, ty = Math.floor(idx / map.w);
      const img = this.scene.add.image((tx + 0.5) * TILE, (ty + 0.5) * TILE - 2, 'prop_' + p.kind).setDepth((ty + 1) * TILE - 1);
      this.props.set(idx, img);
    }
    // Espinhos
    this.traps = map.traps.map((tr) => ({ tr, img: this.scene.add.image((tr.tx + 0.5) * TILE, (tr.ty + 0.5) * TILE, 'spikes_0').setDepth(DEPTH_TRAPS), state: 0 }));
    // Decoração das paredes
    for (const d of map.decor) {
      const key = 'decor_' + d.kind;
      if (!this.scene.textures.exists(key)) continue;
      this.mapObjects.push(this.scene.add.image(d.tx * TILE, d.ty * TILE, key).setOrigin(0, 0).setDepth(1));
    }
    // Placas
    const start = rooms[this.world.startRoomId];
    this.mapObjects.push(this.scene.add.text((start.cx + 0.5) * TILE, (start.y0 + 1.6) * TILE, `COLÉGIO ANTARES\nANDAR ${this.world.floorNum}`,
      textStyle(18, '#fff6d8', { align: 'center', stroke: '#3a1e0e', strokeThickness: 4 })).setOrigin(0.5, 0).setDepth(1));
    const boss = rooms[this.world.bossRoomId];
    this.mapObjects.push(this.scene.add.text((boss.cx + 0.5) * TILE, (boss.y0 + 1.4) * TILE, this.world.floorDef.bossRoomName || 'Sala do Chefe',
      textStyle(18, '#ffd0d0', { stroke: '#3a0e0e', strokeThickness: 4 })).setOrigin(0.5, 0).setDepth(1));
    for (const r of rooms) {
      const label = r.type === 'shop' ? 'CANTINA' : r.type === 'statue' ? 'SALA DA ESTÁTUA' : r.type === 'heal' ? 'ENFERMARIA' : null;
      if (label) this.mapObjects.push(this.scene.add.text((r.cx + 0.5) * TILE, (r.y0 + r.h - 2) * TILE, label, textStyle(18, '#fff6d8', { stroke: '#3a1e0e', strokeThickness: 4 })).setOrigin(0.5, 0).setDepth(1));
    }
  }

  clearMapObjects() {
    this.tilemap?.destroy();
    this.doors?.forEach((d) => d.sprite.destroy());
    this.props?.forEach((p) => p.destroy());
    this.traps?.forEach((t) => t.img.destroy());
    this.mapObjects?.forEach((o) => o.destroy());
  }

  tileIndex(map, x, y) {
    const t = map.get(x, y);
    if (t === T.VOID) return -1;
    const theme = map.theme[map.idx(x, y)] ?? 0;
    const base = theme * TILESET_COLS;
    if (t === T.WALL) {
      const below = map.get(x, y + 1);
      return base + (below === T.FLOOR || below === T.DOOR || below === T.OBSTACLE || below === T.PROP ? TILE_KIND.WALL_FACE : TILE_KIND.WALL_TOP);
    }
    if (t === T.OBSTACLE) return base + TILE_KIND.OBSTACLE;
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (h % 11 === 0) return base + TILE_KIND.FLOOR_B;
    if (h % 17 === 0) return base + TILE_KIND.FLOOR_C;
    return base + TILE_KIND.FLOOR_A;
  }

  /** Caixa/barril quebrou: some o sprite e o tile vira chão. */
  onPropBreak(ev) {
    const img = this.props.get(ev.idx);
    if (img) { img.destroy(); this.props.delete(ev.idx); }
    const map = this.world.map;
    const tx = ev.idx % map.w, ty = Math.floor(ev.idx / map.w);
    this.layer.putTileAt(this.tileIndex(map, tx, ty), tx, ty);
  }

  onPropHit(ev) {
    const img = this.props.get(ev.idx);
    if (!img) return;
    img.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => img.active && img.clearTint());
  }

  // ---------------------------------------------------------------- sincronização
  sync(dt, time) {
    const w = this.world;
    const seen = new Set();
    this.groundFx.clear();
    this.fx.clear();

    for (const a of w.areas) this.drawArea(a, time);
    for (const p of w.players) { seen.add(p.id); this.syncPlayer(p, time); }
    for (const e of w.enemies) { seen.add(e.id); this.syncEnemy(e, time); }
    for (const pr of w.projectiles) { seen.add(pr.id); this.syncProjectile(pr, dt); }
    for (const pk of w.pickups) { seen.add(pk.id); this.syncPickup(pk, time); }
    for (const al of w.allies || []) { seen.add(al.id); this.syncAlly(al, time); }
    for (const b of w.beams || []) this.drawBeam(b, time);

    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.destroy();
        this.views.delete(id);
      }
    }

    for (const d of this.doors) {
      const locked = w.map.locked.has(d.owner);
      if (locked !== d.shown) {
        d.shown = locked;
        d.sprite.setVisible(locked);
        if (locked) {
          d.sprite.setScale(1, 0.1);
          this.scene.tweens.add({ targets: d.sprite, scaleY: 1, duration: 180, ease: 'Back.out' });
        }
      }
    }

    const t = w.time;
    const cam = this.scene.cameras.main.worldView;
    for (const tp of this.traps) {
      const st = trapState(tp.tr, t);
      if (st !== tp.state) { tp.state = st; tp.img.setTexture('spikes_' + st); }
      tp.img.setVisible(tp.img.x > cam.x - 40 && tp.img.x < cam.right + 40 && tp.img.y > cam.y - 40 && tp.img.y < cam.bottom + 40);
    }

    for (const e of w.enemies) if (!e.dead && e.telegraph) this.drawTelegraph(e);
  }

  view(id, factory) {
    let v = this.views.get(id);
    if (!v) {
      v = factory();
      this.views.set(id, v);
    }
    return v;
  }

  // ---------------------------------------------------------------- jogador
  syncPlayer(p, time) {
    const s = this.scene;
    const v = this.view(p.id, () => {
      const objs = {
        shadow: s.add.image(p.x, p.y, 'shadow'),
        body: s.add.sprite(p.x, p.y, 'char_' + p.charId).play('char_' + p.charId + '_idle'),
        weapon: s.add.image(p.x, p.y, 'wpn_' + p.weapons[p.cur]).setOrigin(0.2, 0.5),
        label: this.world.players.length > 1 ? s.add.text(p.x, p.y, p.name, textStyle(16, this.localIds.has(p.id) ? '#ffd23f' : '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5) : null,
        buff: s.add.text(p.x, p.y, '×5', textStyle(22, '#ffd23f', { stroke: '#3a1e00', strokeThickness: 4 })).setOrigin(0.5).setVisible(false),
        bubble: s.add.image(p.x, p.y, 'letters').setVisible(false).setAlpha(0.85),
        status: s.add.text(p.x, p.y, '', textStyle(16, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5),
        cage: s.add.image(p.x, p.y, 'cage').setVisible(false),
        recoil: 0, swingT: 0, weaponKey: null, hurtT: 0, anim: 'idle'
      };
      objs.destroy = () => { for (const k of ['shadow', 'body', 'weapon', 'label', 'buff', 'bubble', 'status', 'cage']) objs[k]?.destroy(); };
      return objs;
    });
    if (p.dead) {
      for (const k of ['shadow', 'body', 'weapon', 'label', 'buff', 'bubble', 'status', 'cage']) v[k]?.setVisible(false);
      return;
    }
    const by = p.y - 6;
    const depth = p.y;
    v.shadow.setVisible(true).setPosition(p.x, p.y + 10).setDepth(depth - 1);
    v.body.setVisible(true).setPosition(p.x, by).setDepth(depth);
    const face = Math.cos(p.aim) < 0 ? -1 : 1;
    v.body.setFlipX(face < 0);
    if (v.label) v.label.setVisible(true).setPosition(p.x, by - 26).setDepth(depth + 1);

    // presa na cela (Suspensão)
    v.cage.setVisible(p.jailTimer > 0).setPosition(p.x, p.y - 8).setDepth(depth + 3);
    if (p.jailTimer > 0) v.status.setText('SUSPENSO ' + Math.ceil(p.jailTimer) + 's').setColor('#ff9a9a');
    else if (p.signing > 0) v.status.setText('assinando... (sem atacar)').setColor('#ffd0d0');
    else if (p.downed) v.status.setText(this.world.players.length > 1 ? 'CAÍDO! fique parado perto' : '').setColor('#ff8a8a');
    else v.status.setText('');
    v.status.setPosition(p.x, by - (v.label ? 40 : 28)).setDepth(depth + 4);

    v.bubble.setVisible(p.buffs?.bubbleTimer > 0 && !p.downed).setPosition(p.x, p.y - 6).setRotation(time / 500).setDepth(depth + 2);

    if (p.downed) {
      v.body.setAngle(90).setTint(0x8888aa);
      v.body.anims.stop();
      v.weapon.setVisible(false);
      v.buff.setVisible(false);
      const prog = p.reviveProgress / REVIVE_TIME;
      this.fx.lineStyle(3, 0x000000, 0.5).strokeCircle(p.x, p.y - 4, 22);
      if (prog > 0) {
        this.fx.lineStyle(3, 0x5ee05e, 1);
        this.fx.beginPath();
        this.fx.arc(p.x, p.y - 4, 22, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        this.fx.strokePath();
      }
      return;
    }
    v.body.setAngle(0);
    const anim = p.moving ? 'walk' : 'idle';
    if (anim !== v.anim || !v.body.anims.isPlaying) {
      v.anim = anim;
      v.body.play('char_' + p.charId + '_' + anim, true);
    }
    v.hurtT = Math.max(0, v.hurtT - 1 / 60);
    if (v.hurtT > 0) v.body.setTint(0xff6060);
    else if (p.signing > 0) v.body.setTint(0x9a9aaa);
    else if (p.buffs.hasteTimer > 0) v.body.setTint(Math.floor(time / 90) % 2 ? 0xc8ffc8 : 0xffffff);
    else v.body.clearTint();
    v.body.setAlpha(p.invuln > 0 && Math.floor(time / 60) % 2 ? 0.45 : 1);

    if (p.signing > 0) {
      // caderno preto na frente do jogador + barra de "libertação"
      v.weapon.setVisible(false);
      this.fx.fillStyle(0x1b1b22, 1).fillRect(p.x - 8, by + 2, 16, 12);
      this.fx.fillStyle(0xfbfbf3, 1).fillRect(p.x - 5, by + 4, 10, 3);
      if (p.signFree > 0) {
        this.fx.fillStyle(0x000000, 0.6).fillRect(p.x - 14, by + 18, 28, 4);
        this.fx.fillStyle(0x5ee05e, 1).fillRect(p.x - 14, by + 18, 28 * Math.min(1, p.signFree), 4);
      }
    } else {
      const wkey = 'wpn_' + p.weapons[p.cur];
      if (v.weaponKey !== wkey) { v.weapon.setTexture(wkey); v.weaponKey = wkey; }
      v.recoil *= 0.8;
      let ang = p.aim;
      if (v.swingT > 0) {
        v.swingT -= 1 / 60;
        const k = 1 - v.swingT / 0.16;
        ang = p.aim + (v.swingArc / 2) * (k * 2 - 1) * face;
      }
      const shake = (p.wstate?.spin || 0) > 0.5 ? (Math.random() - 0.5) * 2 * p.wstate.spin : 0;
      const hx = p.x + Math.cos(ang) * (7 - v.recoil) + shake;
      const hy = by + 6 + Math.sin(ang) * (5 - v.recoil) + shake;
      v.weapon.setVisible(p.jailTimer <= 0).setPosition(hx, hy).setRotation(ang).setFlipY(Math.cos(ang) < 0);
      v.weapon.setDepth(Math.sin(ang) < -0.35 ? depth - 0.5 : depth + 0.5);
    }

    this.drawWeaponState(p, by, time);

    if (p.buffs.nextHitMul > 1) {
      v.buff.setVisible(true).setText('×' + p.buffs.nextHitMul).setPosition(p.x, by - 26 - (v.label ? 14 : 0) + Math.sin(time / 120) * 2).setDepth(depth + 2);
    } else v.buff.setVisible(false);
  }

  onShoot(ev) {
    const v = this.views.get(ev.playerId);
    if (!v || ev.wtype === 'melee') return;
    v.recoil = 4;
  }

  onSwing(ev) {
    const v = this.views.get(ev.playerId);
    if (v) { v.swingT = 0.16; v.swingArc = (ev.arc * Math.PI) / 180; }
  }

  onPlayerHit(ev) {
    const v = this.views.get(ev.id);
    if (v) v.hurtT = 0.15;
  }

  // ---------------------------------------------------------------- inimigos
  enemyKeys(e) {
    if (e.type === 'aluno') { const k = 'aluno_' + (e.id % 4); return { tex: k, anim: k + '_walk', scale: 1 }; }
    const sp = e.def.sprite;
    if (sp?.texture) return { tex: sp.texture, anim: sp.texture + '_walk', scale: sp.scale || 1, character: true };
    const k = 'enemy_' + e.type;
    return { tex: k, anim: k + '_move', scale: 1 };
  }

  syncEnemy(e, time) {
    const s = this.scene;
    const keys = this.enemyKeys(e);
    const v = this.view(e.id, () => {
      const objs = {
        shadow: s.add.image(e.x, e.y, 'shadow').setScale(e.def.boss ? 2.6 : e.r > 15 ? 1.8 : 1),
        body: s.add.sprite(e.x, e.y, keys.tex).play(keys.anim),
        spawn: s.add.image(e.x, e.y, 'spawn_circle').setScale(e.def.boss ? 2.4 : 1),
        angry: false
      };
      objs.body.anims.setProgress(Math.random());
      objs.destroy = () => { objs.shadow.destroy(); objs.body.destroy(); objs.spawn.destroy(); };
      return objs;
    });
    const flying = !!e.def.flying;
    const bob = flying ? Math.sin(time / 180 + e.id) * 3 - 6 : 0;
    const scale = keys.scale * (e.elite ? 1.2 : 1);
    const lift = e.def.boss ? (keys.character ? 22 : 18) : e.type === 'diva' ? 6 : 6;
    const by = e.y - lift + bob;
    v.shadow.setPosition(e.x, e.y + e.r * 0.8).setDepth(e.y - 1).setAlpha(flying ? 0.6 : 1);
    v.body.setPosition(e.x, by).setDepth(e.y).setFlipX(e.facing < 0 && e.type !== 'maquina_xerox');

    if (e.spawning > 0) {
      const k = 1 - e.spawning / 0.9;
      v.spawn.setVisible(true).setPosition(e.x, e.y + e.r * 0.6).setDepth(DEPTH_GROUND_FX + 1).setAngle(time / 4).setAlpha(0.6 + Math.sin(time / 50) * 0.3);
      v.body.setAlpha(Math.max(0, Math.min(1, k))).setScale(scale * (0.4 + 0.6 * Math.max(0, k)));
      v.shadow.setAlpha(0);
      return;
    }
    v.spawn.setVisible(false);
    if (e.burrowed) {
      // enterrado: some o corpo e fica só um monte de terra que se mexe
      v.body.setVisible(false); v.shadow.setAlpha(0);
      const g = this.groundFx, wob = Math.sin(time / 90 + e.id) * 2;
      g.fillStyle(0x4a3220, 0.9).fillEllipse(e.x, e.y + 4, e.r * 2 + wob, e.r * 1.2 - wob * 0.5);
      g.fillStyle(0x6b4a30, 0.9).fillEllipse(e.x - 2, e.y + 1, e.r * 1.3, e.r * 0.7);
      return;
    }
    v.body.setVisible(true);
    v.body.setAlpha(1).setScale(scale);

    if (e.type === 'maquina_xerox' && e.phase2 && !v.angry) {
      v.angry = true;
      v.body.play('enemy_maquina_xerox_angry');
    }
    if (keys.character) {
      const moving = e.state === 'idle' || e.state === 'advertencia' || e.state === 'combo';
      const want = moving ? keys.anim : keys.tex + '_idle';
      if (v.body.anims.currentAnim?.key !== want) v.body.play(want);
    }

    // cor de status / flash de dano
    if (e.flash > 0) v.body.setTintFill(0xffffff);
    else if (e.status.frozen > 0) v.body.setTint(0x7fd0ff);
    else if (e.status.stun > 0) v.body.setTint(Math.floor(time / 120) % 2 ? 0xfff8c0 : 0xffffff);
    else if (e.status.slow > 0) v.body.setTint(0xb0e8ff);
    else if (e.status.burn) v.body.setTint(Math.floor(time / 100) % 2 ? 0xff9a5a : 0xffd0a0);
    else if (e.status.poison) v.body.setTint(0xa8f080);
    else if (e.state === 'windup' || e.state === 'jam_windup' || e.state === 'fuse') v.body.setTint(Math.floor(time / 70) % 2 ? 0xff7070 : 0xffffff);
    else if (e.state === 'stunned') v.body.setTint(0xb0b0c0);
    else if (e.elite) v.body.setTint(Math.floor(time / 200) % 2 ? 0xffe08a : 0xfff4d0);
    else if (e.def.boss && e.phase >= 3) v.body.setTint(Math.floor(time / 150) % 2 ? 0xff9a9a : 0xffffff);
    else v.body.clearTint();

    if ((e.state === 'windup' && e.def.behavior === 'chaser') || e.state === 'fuse') v.body.x += Math.sin(time / 15) * 1.5;

    if (e.elite) {
      this.groundFx.lineStyle(2, 0xffd23f, 0.6 + Math.sin(time / 150) * 0.3).strokeEllipse(e.x, e.y + e.r * 0.8, e.r * 2.6, e.r * 1.1);
    }
    if (e.type === 'caderno_preto') {
      this.groundFx.fillStyle(0x000000, 0.35).fillCircle(e.x, e.y + 10, 22);
    }
    // Divã curando a Katia
    if (e.type === 'diva' && e.healTarget) {
      const boss = this.world.enemies.find((b) => b.id === e.healTarget);
      if (boss) {
        this.fx.lineStyle(3, 0x5ee05e, 0.35 + Math.sin(time / 80) * 0.25).lineBetween(e.x, e.y - 10, boss.x, boss.y - 20);
      }
    }
    // barrinha de vida (inimigos comuns já feridos)
    if (!e.def.boss && !e.def.invulnerable && e.hp < e.maxHp) {
      const w = e.r > 15 ? 36 : 22, x = e.x - w / 2, y = by - (e.r > 15 ? 28 : 20) * scale;
      this.fx.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 5);
      this.fx.fillStyle(e.elite ? 0xffb02e : 0xe04848, 1).fillRect(x, y, Math.max(1, (w * e.hp) / e.maxHp), 3);
    }
  }

  // ---------------------------------------------------------------- aliados
  syncAlly(a, time) {
    const s = this.scene;
    const v = this.view(a.id, () => {
      const tex = s.textures.exists('ally_' + a.kind) ? 'ally_' + a.kind : 'ally_planta';
      const body = s.add.sprite(a.x, a.y, tex);
      if (a.kind === 'planta') body.play('ally_planta_bite');
      const o = { shadow: s.add.image(a.x, a.y, 'shadow').setScale(a.kind === 'mine' ? 0.6 : 1), body };
      o.destroy = () => { o.shadow.destroy(); o.body.destroy(); };
      return o;
    });
    const fading = a.life < 1.5 && Math.floor(time / 100) % 2;
    if (a.kind === 'mine') {
      v.shadow.setPosition(a.x, a.y + 4).setDepth(DEPTH_TRAPS + 1);
      v.body.setPosition(a.x, a.y).setDepth(DEPTH_TRAPS + 2).setFrame(a.armed && Math.floor(time / 250) % 2 ? 1 : 0).setAlpha(a.armed ? 1 : 0.6);
      return;
    }
    v.shadow.setPosition(a.x, a.y + 10).setDepth(a.y - 1);
    v.body.setPosition(a.x, a.y - 8).setDepth(a.y).setFlipX(Math.cos(a.aim || 0) < 0).setAlpha(fading ? 0.5 : 1);
    if (a.kind === 'turret') v.body.setRotation(0);
  }

  // ---------------------------------------------------------------- armas: raios e estados
  drawBeam(b, time) {
    const g = this.fx;
    const col = hexToInt(b.color || '#ffffff');
    const jit = Math.sin(time / 30) * 0.8;
    g.lineStyle(b.width + 8, col, 0.18).lineBetween(b.x1, b.y1, b.x2, b.y2 + jit);
    g.lineStyle(b.width, col, 0.85).lineBetween(b.x1, b.y1, b.x2, b.y2 + jit);
    g.lineStyle(Math.max(1, b.width / 3), 0xffffff, 0.95).lineBetween(b.x1, b.y1, b.x2, b.y2 + jit);
    g.fillStyle(0xffffff, 0.9).fillCircle(b.x2, b.y2, b.width * 0.6 + Math.random() * 2);
    g.fillStyle(col, 0.5).fillCircle(b.x1, b.y1, b.width * 0.7);
  }

  /** Carga, escudo levantado e rastro da estocada em volta do jogador. */
  drawWeaponState(p, by, time) {
    const ws = p.wstate;
    const g = this.fx;
    if (ws?.charge > 0) {
      const full = ws.charge >= 1;
      g.lineStyle(3, 0x000000, 0.45).strokeCircle(p.x, by + 2, 17);
      g.lineStyle(3, full ? (Math.floor(time / 80) % 2 ? 0xffffff : 0xffd23f) : 0xffd23f, 1);
      g.beginPath();
      g.arc(p.x, by + 2, 17, -Math.PI / 2, -Math.PI / 2 + Math.min(1, ws.charge) * Math.PI * 2);
      g.strokePath();
    }
    if (ws?.shielding) {
      const w = this.data.weapon(p.weapons[p.cur]);
      const half = ((w.melee?.shield?.arc || 110) * Math.PI) / 360;
      g.lineStyle(5, 0x9fd8ff, 0.75);
      g.beginPath();
      g.arc(p.x, by + 4, 22, p.aim - half, p.aim + half);
      g.strokePath();
      g.lineStyle(2, 0xffffff, 0.9);
      g.beginPath();
      g.arc(p.x, by + 4, 24, p.aim - half, p.aim + half);
      g.strokePath();
    }
    if (p.dash) {
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(0xffffff, 0.25 / i).fillCircle(p.x - Math.cos(p.aim) * i * 9, by + 4 - Math.sin(p.aim) * i * 9, 9 - i);
      }
    }
  }

  // ---------------------------------------------------------------- projéteis
  syncProjectile(pr, dt) {
    const s = this.scene;
    const v = this.view(pr.id, () => {
      let key = pr.sprite;
      if (pr.glyph) key = 'glyph_' + pr.glyph.codePointAt(0);
      if (!s.textures.exists(key)) key = pr.team === 'enemy' ? 'ebullet_paper' : 'energy';
      const img = s.add.image(pr.x, pr.y, key).setDepth(DEPTH_PROJ);
      if (pr.sprite === 'proj_nota_mil') img.setDepth(DEPTH_PROJ + 10);
      if (pr.team === 'player' && pr.sprite?.startsWith('ebullet')) img.setTint(0x9fffd0); // bala rebatida pelo taco
      const objs = { img, rot: 0, age: 0, r0: pr.r, rLast: pr.r, destroy: () => img.destroy() };
      return objs;
    });
    v.age += dt;
    // raio mudou (globo bumerangue cresce na volta): escala a imagem
    if (pr.r !== v.rLast && v.r0) { v.rLast = pr.r; v.img.setScale(pr.r / v.r0); }
    const z = pr.z || 0;
    v.img.setPosition(pr.x, pr.y - z);
    const target = pr.lobTarget || (pr.lob ? [pr.lob.tx, pr.lob.ty] : null);
    if (target) {
      // arremesso em arco: sombra no chão e marcador de onde vai cair
      this.groundFx.fillStyle(0x000000, 0.3).fillEllipse(pr.x, pr.y + 4, 12, 5);
      this.groundFx.lineStyle(2, 0xffd23f, 0.6 + Math.sin(v.age * 20) * 0.3).strokeCircle(target[0], target[1], 14);
      v.img.setDepth(DEPTH_PROJ + 5);
    }
    if (pr.spin) {
      v.rot += pr.spin * dt;
      v.img.setRotation(v.rot);
    } else if (pr.sprite === 'proj_nota_mil') {
      v.img.setRotation(0);
      v.img.setScale(1 + Math.sin(v.age * 20) * 0.05);
    } else if (!pr.glyph) {
      v.img.setRotation(Math.atan2(pr.vy, pr.vx));
    }
    if (pr.team === 'enemy') v.img.setScale(1 + Math.sin(v.age * 18) * 0.12);
  }

  // ---------------------------------------------------------------- itens
  syncPickup(pk, time) {
    const s = this.scene;
    const v = this.view(pk.id, () => {
      const o = { parts: [] };
      switch (pk.kind) {
        case 'weapon': {
          const w = this.data.weapon(pk.weaponId);
          const col = hexToInt(this.data.rarities[w.rarity].color);
          o.glow = s.add.image(pk.x, pk.y, 'soft').setTint(col).setAlpha(0.45).setScale(0.7, 0.35);
          o.img = s.add.image(pk.x, pk.y, 'wpn_' + pk.weaponId).setScale(1.25);
          o.key = pk.weaponId;
          o.parts.push(o.glow, o.img);
          break;
        }
        case 'shop_item': {
          const tex = pk.item === 'weapon' ? 'wpn_' + pk.weaponId : ITEM_ICON[pk.item] || 'coin';
          o.glow = s.add.image(pk.x, pk.y, 'soft').setTint(pk.item === 'weapon' ? hexToInt(this.data.rarities[this.data.weapon(pk.weaponId).rarity].color) : 0xffffff).setAlpha(0.35).setScale(0.6, 0.3);
          o.img = s.add.image(pk.x, pk.y, tex).setScale(pk.item === 'weapon' ? 1.25 : 1.8);
          o.price = s.add.text(pk.x, pk.y + 16, pk.price + ' ●', textStyle(18, '#f2c94c', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5, 0);
          o.parts.push(o.glow, o.img, o.price);
          break;
        }
        case 'statue': {
          o.img = s.add.image(pk.x, pk.y - 14, 'statue');
          const b = BLESSINGS[pk.blessing];
          o.price = s.add.text(pk.x, pk.y + 16, `${b?.desc || ''}\n${pk.price} ●`, textStyle(16, '#f2c94c', { align: 'center', stroke: '#000', strokeThickness: 3 })).setOrigin(0.5, 0);
          o.parts.push(o.img, o.price);
          break;
        }
        case 'npc':
          o.img = s.add.sprite(pk.x, pk.y, 'char_cantineira').play('char_cantineira_idle');
          o.name = s.add.text(pk.x, pk.y - 26, 'Tia da Cantina', textStyle(16, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5);
          o.parts.push(o.img, o.name);
          break;
        case 'chest': o.img = s.add.image(pk.x, pk.y, 'chest_closed'); o.parts.push(o.img); break;
        case 'heal_station': o.img = s.add.image(pk.x, pk.y, 'heal_station'); o.parts.push(o.img); break;
        case 'portal':
          o.glow = s.add.image(pk.x, pk.y, 'soft').setTint(0x8fe3ff).setAlpha(0.5).setScale(1.6, 1.1);
          o.img = s.add.sprite(pk.x, pk.y, 'portal').play('portal_spin').setScale(1.2);
          o.parts.push(o.glow, o.img);
          break;
        case 'energy': o.img = s.add.image(pk.x, pk.y, 'energy'); o.parts.push(o.img); break;
        case 'coin': o.img = s.add.image(pk.x, pk.y, 'coin'); o.parts.push(o.img); break;
        case 'health': o.img = s.add.image(pk.x, pk.y, 'apple'); o.parts.push(o.img); break;
        default: o.img = s.add.image(pk.x, pk.y, 'px'); o.parts.push(o.img);
      }
      o.destroy = () => o.parts.forEach((p) => p.destroy());
      return o;
    });
    const bob = Math.sin(time / 250 + pk.id) * 2;
    switch (pk.kind) {
      case 'weapon':
        if (v.key !== pk.weaponId) {
          v.destroy();
          this.views.delete(pk.id);
          return this.syncPickup(pk, time);
        }
        v.glow.setPosition(pk.x, pk.y + 6).setDepth(pk.y - 2).setAlpha(0.35 + Math.sin(time / 200) * 0.12);
        v.img.setPosition(pk.x, pk.y - 4 + bob).setDepth(pk.y);
        break;
      case 'shop_item':
        v.glow.setPosition(pk.x, pk.y + 6).setDepth(pk.y - 2);
        v.img.setPosition(pk.x, pk.y - 4 + bob).setDepth(pk.y);
        v.price.setDepth(pk.y + 1);
        break;
      case 'statue': {
        v.img.setDepth(pk.y);
        v.price.setDepth(pk.y + 1);
        const mine = [...this.localIds].some((id) => pk.usedBy?.includes(id));
        v.img.setTint(mine ? 0x9a9a9a : 0xffffff);
        v.price.setAlpha(mine ? 0.4 : 1);
        break;
      }
      case 'npc':
        v.img.setDepth(pk.y); v.name.setDepth(pk.y + 1);
        break;
      case 'chest':
        v.img.setTexture(pk.opened ? 'chest_open' : 'chest_closed').setPosition(pk.x, pk.y).setDepth(pk.y);
        break;
      case 'heal_station':
        v.img.setTexture(pk.used ? 'heal_station_used' : 'heal_station').setPosition(pk.x, pk.y).setDepth(pk.y);
        break;
      case 'portal':
        v.glow.setPosition(pk.x, pk.y).setDepth(pk.y - 2).setAlpha(0.4 + Math.sin(time / 150) * 0.15);
        v.img.setPosition(pk.x, pk.y).setDepth(pk.y);
        break;
      default:
        v.img.setPosition(pk.x, pk.y - 3 + (pk.vx || pk.vy ? 0 : bob)).setDepth(pk.y);
    }
  }

  // ---------------------------------------------------------------- áreas e avisos
  drawArea(a, time) {
    const g = this.groundFx;
    const k = Math.min(1, a.t / a.life);
    switch (a.kind) {
      case 'toner_warning':
        g.fillStyle(0xff3d6e, 0.12 + 0.2 * k).fillCircle(a.x, a.y, a.r * k);
        g.lineStyle(2, 0xff3d6e, 0.9).strokeCircle(a.x, a.y, a.r);
        g.fillStyle(0x2a1a3a, 0.5).fillEllipse(a.x, a.y - (1 - k) * 120, 18, 18);
        break;
      case 'toner_puddle': {
        const fade = a.life - a.t < 0.6 ? (a.life - a.t) / 0.6 : 1;
        g.fillStyle(0x2a1a3a, 0.75 * fade).fillEllipse(a.x, a.y, a.r * 2, a.r * 1.4);
        g.fillStyle(0x6a3a9a, 0.5 * fade).fillEllipse(a.x - 6, a.y - 4, a.r * 0.8, a.r * 0.5);
        break;
      }
      case 'rain_mark': {
        g.fillStyle(0xff3d6e, 0.1 + 0.25 * k).fillCircle(a.x, a.y, a.r * k);
        g.lineStyle(2, 0xffd23f, 0.85).strokeCircle(a.x, a.y, a.r);
        break;
      }
      case 'pool': {
        const fade = a.life - a.t < 0.6 ? (a.life - a.t) / 0.6 : 1;
        const col = POOL_COLORS[a.style] ?? 0xe04ad0;
        g.fillStyle(col, 0.45 * fade).fillEllipse(a.x, a.y, a.r * 2, a.r * 1.4);
        g.fillStyle(0xffffff, 0.15 * fade).fillEllipse(a.x - a.r * 0.3, a.y - a.r * 0.2, a.r * 0.6, a.r * 0.3);
        break;
      }
      case 'singularity':
      case 'gravity': {
        const fade = a.life - a.t < 0.5 ? (a.life - a.t) / 0.5 : 1;
        g.fillStyle(0x3a1a6a, 0.35 * fade).fillCircle(a.x, a.y, a.r);
        for (let i = 0; i < 3; i++) {
          const rr = ((time / 6 + i * 40) % a.r);
          g.lineStyle(2, 0xb08aff, (1 - rr / a.r) * fade).strokeCircle(a.x, a.y, a.r - rr);
        }
        g.fillStyle(0x0d0b14, fade).fillCircle(a.x, a.y, 10);
        g.lineStyle(2, 0xffffff, 0.8 * fade).strokeCircle(a.x, a.y, 12);
        break;
      }
      case 'ink_trail': {
        const fade = a.life - a.t < 0.6 ? (a.life - a.t) / 0.6 : 1;
        g.fillStyle(0x14102a, 0.7 * fade).fillEllipse(a.x, a.y, a.r * 2, a.r * 1.4);
        g.fillStyle(0x3a2a6a, 0.4 * fade).fillEllipse(a.x - 4, a.y - 3, a.r * 0.8, a.r * 0.5);
        break;
      }
      case 'fire_ground': {
        const fade = a.life - a.t < 0.6 ? (a.life - a.t) / 0.6 : 1;
        g.fillStyle(0xd0401a, 0.55 * fade).fillEllipse(a.x, a.y, a.r * 2, a.r * 1.4);
        g.fillStyle(0xffb030, (0.4 + Math.sin(time / 70 + a.id) * 0.15) * fade).fillEllipse(a.x, a.y - 2, a.r * 1.1, a.r * 0.7);
        break;
      }
      case 'warn_circle':
        g.fillStyle(0xff3d3d, 0.1 + 0.2 * k).fillCircle(a.x, a.y, a.r * k);
        g.lineStyle(2, 0xff3d3d, 0.85).strokeCircle(a.x, a.y, a.r);
        break;
      case 'private_circle':
        g.fillStyle(0xb07ad0, 0.12).fillCircle(a.x, a.y, a.r);
        g.lineStyle(4, 0xe0b0ff, 0.6 + Math.sin(time / 100) * 0.3).strokeCircle(a.x, a.y, a.r);
        break;
      case 'cela':
        g.fillStyle(0x000000, 0.4).fillRect(a.x - 30, a.y - 36, 60, 70);
        break;
      default:
        break;
    }
  }

  /** Aviso de ataque de qualquer inimigo: faixa (line) ou círculo (circle). */
  drawTelegraph(b) {
    const t = b.telegraph;
    const g = this.groundFx;
    if (t.type === 'circle') {
      g.fillStyle(0xff3d3d, 0.2).fillCircle(t.x, t.y, t.r);
      g.lineStyle(2, 0xff3d3d, 0.85).strokeCircle(t.x, t.y, t.r);
      return;
    }
    if (t.type !== 'line') return;
    const cos = Math.cos(t.angle), sin = Math.sin(t.angle);
    const hw = t.width / 2;
    const nx = -sin * hw, ny = cos * hw;
    const ex = b.x + cos * t.length, ey = b.y + sin * t.length;
    g.fillStyle(0xff3d3d, 0.22);
    g.fillPoints([{ x: b.x + nx, y: b.y + ny }, { x: ex + nx, y: ey + ny }, { x: ex - nx, y: ey - ny }, { x: b.x - nx, y: b.y - ny }], true);
    g.lineStyle(2, 0xff3d3d, 0.8);
    g.lineBetween(b.x + nx, b.y + ny, ex + nx, ey + ny);
    g.lineBetween(b.x - nx, b.y - ny, ex - nx, ey - ny);
  }

  destroy() {
    for (const v of this.views.values()) v.destroy();
    this.views.clear();
    this.clearMapObjects();
    this.groundFx.destroy();
    this.fx.destroy();
  }
}
