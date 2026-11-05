import { generateTextures } from '../render/SpriteFactory.js';

/** Carrega sprites de substituição (se houver) e gera todas as texturas provisórias. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.json('overrides', '/assets/sprites/overrides.json');
  }

  create() {
    const data = this.registry.get('data');
    const sprites = this.cache.json.get('overrides')?.sprites || {};
    const keys = Object.keys(sprites);
    const finish = () => {
      generateTextures(this, data, new Set(keys.filter((k) => this.textures.exists(k))));
      this.scene.start('Menu');
    };
    if (!keys.length) return finish();
    for (const k of keys) {
      const s = sprites[k];
      const url = '/assets/sprites/' + s.file;
      if (s.frameWidth) this.load.spritesheet(k, url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight || s.frameWidth });
      else this.load.image(k, url);
    }
    this.load.once('complete', finish);
    this.load.start();
  }
}
