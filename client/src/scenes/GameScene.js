import { TILE } from '/shared/sim/constants.js';
import { GAME_W, GAME_H } from '../config.js';
import { LocalSession } from '../net/LocalSession.js';
import { WorldRenderer } from '../render/WorldRenderer.js';
import { Effects } from '../render/Effects.js';
import { InputManager } from '../input/InputManager.js';
import { sound } from '../audio/Sound.js';

/** Cena principal da partida (modo solo nesta etapa). */
export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(params) {
    this.characterId = params.characterId;
    this.mode = params.mode || 'solo';
    this.seed = params.seed;
  }

  create() {
    const data = this.registry.get('data');
    this.data_ = data;
    this.localId = 'p1';
    const opts = { maxFloors: 1 };
    if (this.seed !== undefined) opts.seed = this.seed;
    this.session = new LocalSession(data, [{ id: this.localId, characterId: this.characterId, name: 'Jogador 1' }], opts);
    this.world = this.session.world;
    this.renderer = new WorldRenderer(this, this.world, data, this.localId);
    this.effects = new Effects(this, this.renderer, this.localId);
    this.inputMgr = new InputManager(this);

    const cam = this.cameras.main;
    cam.setBounds(-200, -200, this.world.map.w * TILE + 400, this.world.map.h * TILE + 400);
    const p = this.world.getPlayer(this.localId);
    cam.centerOn(p.x, p.y);
    cam.fadeIn(400);

    this.crosshair = this.add.image(0, 0, 'crosshair').setDepth(20000);
    this.input.setDefaultCursor('none');

    this.scene.launch('Hud', { game: this });
    this.hud = this.scene.get('Hud');

    this.input.keyboard.on('keydown-ESC', () => this.pause());
    this.input.keyboard.on('keydown-P', () => this.pause());
    this.input.keyboard.on('keydown-M', () => sound.toggleMute());
    this.input.on('pointerdown', () => sound.unlock());
    sound.unlock();
    sound.playMusic('dungeon');
    this.ended = false;

    this.events.once('shutdown', () => {
      this.input.setDefaultCursor('default');
      this.scene.stop('Hud');
      this.renderer.destroy();
    });
    this.events.on('resume', () => this.input.setDefaultCursor('none'));
  }

  pause() {
    if (this.ended) return;
    this.input.setDefaultCursor('default');
    this.scene.pause();
    this.scene.launch('Pause');
  }

  update(time, delta) {
    const w = this.world;
    const p = w.getPlayer(this.localId);
    if (this.inputMgr.pausePressed()) return this.pause();

    const inp = this.inputMgr.poll(w, p);
    this.session.setInput(this.localId, inp);
    this.session.update(delta);
    const events = this.session.drainEvents();
    if (events.some((e) => e.type === 'floor_start')) this.renderer.buildMap();

    this.renderer.sync(delta / 1000, time);
    this.effects.handle(events, this.hud?.ready ? this.hud : null);

    // Câmera segue o jogador, olhando um pouco para onde ele mira
    const cam = this.cameras.main;
    const look = p.downed ? 0 : 1;
    const tx = p.x + Math.cos(p.aim) * 48 * look - GAME_W / 2;
    const ty = p.y + Math.sin(p.aim) * 32 * look - GAME_H / 2;
    const k = 1 - Math.pow(0.0005, delta / 1000);
    cam.scrollX += (tx - cam.scrollX) * k;
    cam.scrollY += (ty - cam.scrollY) * k;

    // Mira
    const ptr = this.input.activePointer;
    if (this.inputMgr.mode === 'mouse') {
      const wp = cam.getWorldPoint(ptr.x, ptr.y);
      this.crosshair.setVisible(true).setPosition(wp.x, wp.y);
    } else {
      this.crosshair.setVisible(!p.downed).setPosition(p.x + Math.cos(p.aim) * 60, p.y - 4 + Math.sin(p.aim) * 60);
    }

    if (w.state !== 'playing' && !this.ended && w.endTimer > (w.state === 'victory' ? 1.2 : 1.8)) {
      this.ended = true;
      cam.fadeOut(500);
      cam.once('camerafadeoutcomplete', () => {
        this.scene.start('Result', {
          victory: w.state === 'victory',
          stats: { ...w.stats },
          characterId: this.characterId,
          player: { kills: p.kills, damage: p.damageDealt, coins: p.coins, weapons: [...p.weapons] },
          floor: w.floorNum
        });
      });
    }
  }
}
