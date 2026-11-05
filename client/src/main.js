import { GameData } from '/shared/sim/data.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { GAME_W, GAME_H } from './config.js';

async function loadJson(name) {
  const r = await fetch('/shared/data/' + name, { cache: 'no-cache' });
  if (!r.ok) throw new Error('Não foi possível carregar ' + name);
  return r.json();
}

/**
 * A fonte VT323 junta "fi"/"fl" numa ligadura que parece "ñ" (ex.: "Física").
 * Um caractere invisível (ZWNJ) entre as letras impede a ligadura.
 */
function patchLigatures() {
  const fix = (v) => (typeof v === 'string' ? v.replace(/f([il])/g, 'f\u200C$1') : v);
  const orig = Phaser.GameObjects.Text.prototype.setText;
  Phaser.GameObjects.Text.prototype.setText = function (value) {
    return orig.call(this, Array.isArray(value) ? value.map(fix) : fix(value));
  };
}

async function start() {
  await Promise.all([
    document.fonts.load('16px "Press Start 2P"'),
    document.fonts.load('20px "VT323"')
  ]);
  const [weapons, characters, enemies] = await Promise.all([
    loadJson('weapons.json'), loadJson('characters.json'), loadJson('enemies.json')
  ]);
  const data = new GameData({ weapons, characters, enemies });
  patchLigatures();
  document.getElementById('loading').remove();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_W,
    height: GAME_H,
    backgroundColor: '#0d0b14',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true },
    scene: [BootScene, MenuScene, CharacterSelectScene, GameScene, HudScene, PauseScene, ResultScene]
  });
  game.registry.set('data', data);
  window.__game = game; // útil para depuração no console
}

start().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Erro: ' + err.message;
});
