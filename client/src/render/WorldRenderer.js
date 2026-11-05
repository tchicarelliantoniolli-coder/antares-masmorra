import { TILE, T } from '/shared/sim/constants.js';
import { TILESET_COLS, TILE_KIND } from './tileArt.js';
import { hexToInt } from './pixel.js';
import { textStyle } from '../config.js';

const DEPTH_GROUND_FX = 2;
const DEPTH_PROJ = 9000;
const DEPTH_FX = 9500;

/**
 * Desenha o estado da simulação com Phaser. Não decide nada de jogo: só lê o "world".
 * Cada entidade tem uma "view" (sprites) criada/atualizada/destruída conforme aparece no estado.
 */
export class WorldRenderer {
  constructor(scene, world, data, localId) {
    this.scene = scene;
    this.world = world;
    this.data = data;
    this.localId = localId;
    this.views = new Map();
    this.groundFx = scene.add.graphics().setDepth(DEPTH_GROUND_FX);
    this.fx = scene.add.graphics().setDepth(DEPTH_FX);
    this.buildMap();
  }

  buildMap() {
    const { map, rooms } = this.world;
    if (this.tilemap) {
      this.tilemap.destroy();
      this.doors.forEach((d) => d.sprite.destroy());
      this.decor?.forEach((o) => o.destroy());
    }
    const rows = [];
    for (let y = 0; y < map.h; y++) {
      const row = [];
      for (let x = 0; x < map.w; x++) row.push(this.tileIndex(map, x, y));
      rows.push(row);
    }
    this.tilemap = this.scene.make.tilemap({ data: rows, tileWidth: TILE, tileHeight: TILE });
    const ts = this.tilemap.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
    this.layer = this.tilemap.createLayer(0, ts, 0, 0).setDepth(0);

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

    // Placa de boas-vindas na entrada
    this.decor = [];
    const start = rooms[this.world.startRoomId];
    const sx = (start.cx + 0.5) * TILE, sy = (start.y0 + 1.6) * TILE;
    const sign = this.scene.add.text(sx, sy, 'COLÉGIO ANTARES\nENSINO MÉDIO', textStyle(18, '#fff6d8', { align: 'center', stroke: '#3a1e0e', strokeThickness: 4 }))
      .setOrigin(0.5, 0).setDepth(1);
    this.decor.push(sign);
    const boss = rooms[this.world.bossRoomId];
    const bl = this.scene.add.text((boss.cx + 0.5) * TILE, (boss.y0 + 1.4) * TILE, this.world.floorDef.bossRoomName || 'Sala do Chefe',
      textStyle(18, '#ffd0d0', { stroke: '#3a0e0e', strokeThickness: 4 })).setOrigin(0.5, 0).setDepth(1);
    this.decor.push(bl);
  }

  tileIndex(map, x, y) {
    const t = map.get(x, y);
    if (t === T.VOID) return -1;
    const theme = map.theme[map.idx(x, y)] ?? 0;
    const base = theme * TILESET_COLS;
    if (t === T.WALL) {
      const below = map.get(x, y + 1);
      return base + (below === T.FLOOR || below === T.DOOR || below === T.OBSTACLE ? TILE_KIND.WALL_FACE : TILE_KIND.WALL_TOP);
    }
    if (t === T.OBSTACLE) return base + TILE_KIND.OBSTACLE;
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    if (h % 11 === 0) return base + TILE_KIND.FLOOR_B;
    if (h % 17 === 0) return base + TILE_KIND.FLOOR_C;
    return base + TILE_KIND.FLOOR_A;
  }

  // ---------------------------------------------------------------- sincronização
  sync(dt, time) {
    const w = this.world;
    const seen = new Set();
    this.groundFx.clear();
    this.fx.clear();

    for (const p of w.players) { seen.add(p.id); this.syncPlayer(p, time); }
    for (const e of w.enemies) { seen.add(e.id); this.syncEnemy(e, time); }
    for (const pr of w.projectiles) { seen.add(pr.id); this.syncProjectile(pr, dt); }
    for (const pk of w.pickups) { seen.add(pk.id); this.syncPickup(pk, time); }
    for (const a of w.areas) this.drawArea(a);

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

    if (w.boss && !w.boss.dead && w.boss.telegraph) this.drawTelegraph(w.boss);
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
        label: this.world.players.length > 1 ? s.add.text(p.x, p.y, p.name, textStyle(16, '#ffffff', { stroke: '#000', strokeThickness: 3 })).setOrigin(0.5) : null,
        buff: s.add.text(p.x, p.y, '×5', textStyle(22, '#ffd23f', { stroke: '#3a1e00', strokeThickness: 4 })).setOrigin(0.5).setVisible(false),
        recoil: 0, swingT: 0, weaponKey: null, hurtT: 0, anim: 'idle'
      };
      objs.destroy = () => { objs.shadow.destroy(); objs.body.destroy(); objs.weapon.destroy(); objs.label?.destroy(); objs.buff.destroy(); };
      return objs;
    });
    const by = p.y - 6;
    const depth = p.y;
    v.shadow.setPosition(p.x, p.y + 10).setDepth(depth - 1);
    v.body.setPosition(p.x, by).setDepth(depth);
    const face = Math.cos(p.aim) < 0 ? -1 : 1;
    v.body.setFlipX(face < 0);

    if (p.downed) {
      v.body.setAngle(90).setTint(0x8888aa);
      v.body.anims.stop();
      v.weapon.setVisible(false);
      v.buff.setVisible(false);
      // anel de revive
      const prog = p.reviveProgress / 3;
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
    else if (p.buffs.hasteTimer > 0) v.body.setTint(0xc8ffc8);
    else v.body.clearTint();
    v.body.setAlpha(p.invuln > 0 && Math.floor(time / 60) % 2 ? 0.45 : 1);

    // arma na mão, apontando para a mira
    const wkey = 'wpn_' + p.weapons[p.cur];
    if (v.weaponKey !== wkey) { v.weapon.setTexture(wkey); v.weaponKey = wkey; }
    v.recoil *= 0.8;
    let ang = p.aim;
    if (v.swingT > 0) {
      v.swingT -= 1 / 60;
      const k = 1 - v.swingT / 0.16;
      ang = p.aim + (v.swingArc / 2) * (k * 2 - 1) * face;
    }
    const hx = p.x + Math.cos(ang) * (7 - v.recoil);
    const hy = by + 6 + Math.sin(ang) * (5 - v.recoil);
    v.weapon.setVisible(true).setPosition(hx, hy).setRotation(ang).setFlipY(Math.cos(ang) < 0);
    v.weapon.setDepth(Math.sin(ang) < -0.35 ? depth - 0.5 : depth + 0.5);

    if (v.label) v.label.setPosition(p.x, by - 26).setDepth(depth + 1);
    if (p.buffs.nextHitMul > 1) {
      v.buff.setVisible(true).setText('×' + p.buffs.nextHitMul).setPosition(p.x, by - 26 + Math.sin(time / 120) * 2).setDepth(depth + 2);
    } else v.buff.setVisible(false);
  }

  onShoot(ev) {
    const v = this.views.get(ev.playerId);
    if (!v) return;
    if (ev.wtype === 'melee') return;
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
  syncEnemy(e, time) {
    const s = this.scene;
    const key = 'enemy_' + e.type;
    const v = this.view(e.id, () => {
      const objs = {
        shadow: s.add.image(e.x, e.y, 'shadow').setScale(e.def.boss ? 2.6 : 1),
        body: s.add.sprite(e.x, e.y, key).play(key + '_move'),
        spawn: s.add.image(e.x, e.y, 'spawn_circle').setScale(e.def.boss ? 2.4 : 1),
        angry: false
      };
      objs.body.anims.setProgress(Math.random());
      objs.destroy = () => { objs.shadow.destroy(); objs.body.destroy(); objs.spawn.destroy(); };
      return objs;
    });
    const flying = !!e.def.flying;
    const bob = flying ? Math.sin(time / 180 + e.id) * 3 - 6 : 0;
    const by = e.y - (e.def.boss ? 18 : 6) + bob;
    v.shadow.setPosition(e.x, e.y + e.r * 0.8).setDepth(e.y - 1).setAlpha(flying ? 0.6 : 1);
    v.body.setPosition(e.x, by).setDepth(e.y).setFlipX(e.facing < 0 && !e.def.boss);

    if (e.spawning > 0) {
      const k = 1 - e.spawning / 0.9;
      v.spawn.setVisible(true).setPosition(e.x, e.y + e.r * 0.6).setDepth(DEPTH_GROUND_FX + 1).setAngle(time / 4).setAlpha(0.6 + Math.sin(time / 50) * 0.3);
      v.body.setAlpha(Math.max(0, Math.min(1, k))).setScale(0.4 + 0.6 * Math.max(0, k));
      v.shadow.setAlpha(0);
      return;
    }
    v.spawn.setVisible(false);
    v.body.setAlpha(1).setScale(1);

    if (e.def.boss && e.phase2 && !v.angry) {
      v.angry = true;
      v.body.play(key + '_angry');
    }

    // cor de status / flash de dano
    if (e.flash > 0) v.body.setTintFill(0xffffff);
    else if (e.status.frozen > 0) v.body.setTint(0x7fd0ff);
    else if (e.status.slow > 0) v.body.setTint(0xb0e8ff);
    else if (e.status.burn) v.body.setTint(Math.floor(time / 100) % 2 ? 0xff9a5a : 0xffd0a0);
    else if (e.status.poison) v.body.setTint(0xa8f080);
    else if (e.state === 'windup' || e.state === 'jam_windup') v.body.setTint(Math.floor(time / 70) % 2 ? 0xff7070 : 0xffffff);
    else if (e.state === 'stunned') v.body.setTint(0xb0b0c0);
    else v.body.clearTint();

    if (e.state === 'windup' && e.def.behavior === 'chaser') v.body.x += Math.sin(time / 15) * 1.5;

    // barrinha de vida (inimigos comuns já feridos)
    if (!e.def.boss && e.hp < e.maxHp) {
      const w = 22, x = e.x - w / 2, y = by - 20;
      this.fx.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 5);
      this.fx.fillStyle(0xe04848, 1).fillRect(x, y, Math.max(1, (w * e.hp) / e.maxHp), 3);
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
      if (pr.team === 'player' && pr.sprite === 'proj_nota_mil') img.setDepth(DEPTH_PROJ + 10);
      const objs = { img, rot: 0, destroy: () => img.destroy() };
      return objs;
    });
    v.img.setPosition(pr.x, pr.y);
    if (pr.spin) {
      v.rot += pr.spin * dt;
      v.img.setRotation(v.rot);
    } else if (pr.sprite === 'proj_nota_mil') {
      v.img.setRotation(0);
      v.img.setScale(1 + Math.sin(pr.age * 20) * 0.05);
    } else if (!pr.glyph) {
      v.img.setRotation(Math.atan2(pr.vy, pr.vx));
    }
    if (pr.team === 'enemy') v.img.setScale(1 + Math.sin(pr.age * 18) * 0.12);
    if (pr.team === 'player' && pr.sprite?.startsWith('ebullet')) v.img.setTint(0x9fffd0); // bala rebatida pelo taco
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
          // trocou de arma no chão: recria
          v.destroy();
          this.views.delete(pk.id);
          return this.syncPickup(pk, time);
        }
        v.glow.setPosition(pk.x, pk.y + 6).setDepth(pk.y - 2).setAlpha(0.35 + Math.sin(time / 200) * 0.12);
        v.img.setPosition(pk.x, pk.y - 4 + bob).setDepth(pk.y);
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
  drawArea(a) {
    const g = this.groundFx;
    const k = Math.min(1, a.t / a.life);
    if (a.kind === 'toner_warning') {
      g.fillStyle(0xff3d6e, 0.12 + 0.2 * k).fillCircle(a.x, a.y, a.r * k);
      g.lineStyle(2, 0xff3d6e, 0.9).strokeCircle(a.x, a.y, a.r);
      // sombra do toner caindo
      g.fillStyle(0x2a1a3a, 0.5).fillEllipse(a.x, a.y - (1 - k) * 120, 18, 18);
    } else if (a.kind === 'toner_puddle') {
      const fade = a.life - a.t < 0.6 ? (a.life - a.t) / 0.6 : 1;
      g.fillStyle(0x2a1a3a, 0.75 * fade).fillEllipse(a.x, a.y, a.r * 2, a.r * 1.4);
      g.fillStyle(0x6a3a9a, 0.5 * fade).fillEllipse(a.x - 6, a.y - 4, a.r * 0.8, a.r * 0.5);
    }
  }

  drawTelegraph(b) {
    const t = b.telegraph;
    if (t.type !== 'line') return;
    const g = this.groundFx;
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
    this.tilemap?.destroy();
    this.doors?.forEach((d) => d.sprite.destroy());
    this.decor?.forEach((o) => o.destroy());
    this.groundFx.destroy();
    this.fx.destroy();
  }
}

