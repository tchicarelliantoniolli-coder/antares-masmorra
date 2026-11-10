import { DEFAULT_AIM_DIST } from '/shared/sim/constants.js';
import { TouchControls } from '../input/TouchControls.js';
import { GAME_W, GAME_H } from '../config.js';
import { LocalSession } from '../net/LocalSession.js';
import { WorldRenderer } from '../render/WorldRenderer.js';
import { Effects } from '../render/Effects.js';
import { Controller, KeyTracker } from '../input/Controllers.js';
import { sound } from '../audio/Sound.js';

/**
 * Cena da partida. Funciona em 3 modos:
 *  - solo:   1 jogador, simulação local
 *  - local:  co-op local (2 a 4 jogadores no mesmo computador), simulação local
 *  - online: a simulação roda no servidor; aqui só desenhamos o espelho (OnlineSession)
 * params: { mode, players: [{ id, characterId, name, device }], session? }
 */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(params) {
    this.params = params;
    this.mode = params.mode || 'solo';
  }

  create() {
    const data = this.registry.get('data');
    this.data_ = data;
    const params = this.params;
    if (this.mode === 'online') {
      this.session = params.session;
      this.localDevices = [{ id: this.session.myId, device: 'auto' }];
    } else {
      const players = params.players || [{ id: 'p1', characterId: params.characterId, name: 'Jogador 1', device: 'auto' }];
      this.session = new LocalSession(data, players.map((p) => ({ id: p.id, characterId: p.characterId, name: p.name })), params.seed !== undefined ? { seed: params.seed } : {});
      this.localDevices = players.map((p) => ({ id: p.id, device: p.device || 'auto' }));
    }
    this.world = this.session.world;
    this.localIds = this.localDevices.map((d) => d.id);
    this.localId = this.localIds[0];
    this.touch = navigator.maxTouchPoints > 0 ? new TouchControls(() => this.openMenu()) : null;
    this.keys = new KeyTracker();
    this.controllers = this.localDevices.map((d, i) => ({ id: d.id, ctrl: new Controller(this, this.keys, d.device, i === 0 ? this.touch : null) }));

    this.renderer = new WorldRenderer(this, this.world, data, this.localIds);
    this.renderer.builtFloor = this.world.floorNum;
    this.effects = new Effects(this, this.renderer, this.localIds);

    const cam = this.cameras.main;
    const p = this.world.getPlayer(this.localId) || this.world.players[0];
    if (p) cam.centerOn(p.x, p.y);
    cam.fadeIn(400);

    this.crosshair = this.add.image(0, 0, 'crosshair').setDepth(20000).setVisible(false);
    this.aimMarker = this.add.graphics().setDepth(19999); // ponto de impacto de arremesso/chuva/minas
    this.input.setDefaultCursor('none');

    this.scene.launch('Hud', { game: this });
    this.hud = this.scene.get('Hud');

    this.input.keyboard.on('keydown-M', () => sound.toggleMute());
    this.input.on('pointerdown', () => sound.unlock());
    sound.unlock();
    sound.playMusic('dungeon');
    this.ended = false;
    this.menuOpen = false;

    this.events.once('shutdown', () => {
      this.input.setDefaultCursor('default');
      this.scene.stop('Hud');
      this.renderer.destroy();
      this.keys.destroy();
      this.touch?.destroy();
      if (this.mode === 'online') this.session.destroy();
    });
    this.events.on('resume', () => { this.input.setDefaultCursor('none'); this.menuOpen = false; this.touch?.setEnabled(true); this.keys.endFrame(); });
  }

  openMenu() {
    if (this.ended || this.menuOpen) return;
    this.menuOpen = true;
    this.touch?.setEnabled(false);
    this.input.setDefaultCursor('default');
    if (this.mode === 'online') {
      // no online a partida não para: o menu abre por cima
      this.scene.launch('Pause', { online: true });
    } else {
      this.scene.pause();
      this.scene.launch('Pause', { online: false });
    }
  }

  update(time, delta) {
    const w = this.world;
    this.touch?.setEnabled(!this.menuOpen && !this.ended);
    for (const { ctrl } of this.controllers) if (ctrl.pausePressed()) { this.keys.endFrame(); return this.openMenu(); }

    for (const { id, ctrl } of this.controllers) {
      const p = w.getPlayer(id);
      let inp = ctrl.poll(w, p);
      if (this.menuOpen) inp = { moveX: 0, moveY: 0, aim: inp.aim, aimDist: inp.aimDist, fire: false };
      this.session.setInput(id, inp);
    }
    this.keys.endFrame();
    this.session.update(delta);
    const events = this.session.drainEvents();
    if (events.some((e) => e.type === 'floor_start') && this.renderer.builtFloor !== w.floorNum) {
      this.renderer.buildMap();
      this.renderer.builtFloor = w.floorNum;
    }
    this.renderer.sync(delta / 1000, time);
    this.effects.handle(events, this.hud?.ready ? this.hud : null);
    this.updateCamera(delta);

    // Mira do mouse
    const mouseCtrl = this.controllers.find((c) => c.ctrl.showsCrosshair);
    if (mouseCtrl && !this.menuOpen) {
      const ptr = this.input.activePointer;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.crosshair.setVisible(true).setPosition(wp.x, wp.y);
      this.drawAimMarker(w.getPlayer(mouseCtrl.id), wp);
    } else if (this.touch?.enabled) {
      const p = w.getPlayer(this.localId);
      if (p && !p.dead && !p.downed) {
        const wp = { x: p.x + Math.cos(p.aim) * DEFAULT_AIM_DIST, y: p.y - 4 + Math.sin(p.aim) * DEFAULT_AIM_DIST };
        this.crosshair.setVisible(true).setPosition(wp.x, wp.y);
        this.drawAimMarker(p, wp);
      } else { this.crosshair.setVisible(false); this.aimMarker.clear(); }
    } else { this.crosshair.setVisible(false); this.aimMarker.clear(); }

    this.checkEnd();
  }

  /** Com arma de arremesso, chuva ou mina, mostra onde vai cair (limitado ao alcance). */
  drawAimMarker(p, wp) {
    const g = this.aimMarker;
    g.clear();
    if (!p || p.downed || p.dead) return;
    const w = this.data_.weapon(p.weapons[p.cur]);
    const max = w.mode === 'lob' ? w.lob.maxRange : w.mode === 'rain' ? w.rain.maxRange : w.mode === 'deploy' ? 60 : 0;
    if (!max) return;
    const a = Math.atan2(wp.y - (p.y - 4), wp.x - p.x);
    const r = this.world.map.groundRaycast(p.x, p.y, a, Math.min(max, Math.hypot(wp.x - p.x, wp.y - (p.y - 4))));
    const rad = w.mode === 'rain' ? w.rain.radius + w.rain.hitRadius : w.mode === 'lob' ? (w.projectile.explode?.radius || w.lob.pool?.r || 16) : 14;
    g.lineStyle(2, 0xffd23f, 0.55).strokeCircle(r.x, r.y, rad);
    g.fillStyle(0xffd23f, 0.12).fillCircle(r.x, r.y, rad);
  }

  updateCamera(delta) {
    const cam = this.cameras.main;
    const w = this.world;
    const ps = this.localIds.map((id) => w.getPlayer(id)).filter((p) => p && !p.dead);
    const alive = ps.filter((p) => !p.downed);
    const group = alive.length ? alive : ps;
    if (!group.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of group) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    if (group.length === 1) {
      cx += Math.cos(group[0].aim) * 48;
      cy += Math.sin(group[0].aim) * 32;
    }
    // co-op local: afasta a câmera para todos caberem na tela
    const zoomTarget = group.length > 1 ? Math.max(0.6, Math.min(1, (GAME_W - 160) / (maxX - minX + 1), (GAME_H - 140) / (maxY - minY + 1))) : 1;
    const k = 1 - Math.pow(0.0005, delta / 1000);
    cam.setZoom(cam.zoom + (zoomTarget - cam.zoom) * k * 0.5);
    const tx = cx - GAME_W / 2, ty = cy - GAME_H / 2;
    cam.scrollX += (tx - cam.scrollX) * k;
    cam.scrollY += (ty - cam.scrollY) * k;
  }

  checkEnd() {
    if (this.ended) return;
    const w = this.world;
    let result = null;
    if (this.mode === 'online') {
      if (this.session.endData) result = { ...this.session.endData, mode: 'online' };
      else if (this.session.disconnected) result = { victory: false, disconnected: true, stats: w.stats || {}, players: [], mode: 'online' };
    } else if (w.state !== 'playing' && w.endTimer > (w.state === 'victory' ? 1.2 : 1.8)) {
      result = {
        mode: this.mode,
        victory: w.state === 'victory',
        stats: { ...w.stats },
        floor: w.floorNum,
        players: w.players.map((p) => ({ id: p.id, name: p.name, charId: p.charId, kills: p.kills, damage: p.damageDealt, coins: p.coins, weapons: [...p.weapons] })),
        replay: this.params
      };
    }
    if (!result) return;
    this.ended = true;
    this.touch?.setEnabled(false);
    this.scene.stop('Pause');
    const cam = this.cameras.main;
    cam.fadeOut(500);
    cam.once('camerafadeoutcomplete', () => this.scene.start('Result', result));
  }
}
