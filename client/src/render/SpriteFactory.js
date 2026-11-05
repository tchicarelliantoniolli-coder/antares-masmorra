import { drawCharacterSheet, CHAR_FRAMES } from './characterArt.js';
import { drawCadernoZumbi, drawProvaVoadora, drawEstojo, drawXerox, drawProjectile, drawGlyph, drawNotaMil, drawEnemyBullet } from './enemyArt.js';
import {
  drawWeapon, drawChest, drawHealStation, drawPortalFrames, drawEnergyOrb, drawCoin, drawApple, drawShadow,
  drawSpawnCircle, drawCrosshair, drawDoorBar, drawPixel, drawSoftCircle, drawIcon
} from './itemArt.js';
import { buildTileset } from './tileArt.js';
import {
  drawCrate, drawBarrel, drawSpikes, drawDecor, drawLousaEnemy, drawSinal, drawMochila, drawDiva, drawCadernoPreto,
  drawAlunos, drawCantineira, drawStatue, drawPlant, drawCage, drawExtraBullet, drawLetters, drawTurret, drawMine
} from './propArt.js';

export const DECOR_KINDS = ['lousa', 'placar', 'estante_parede', 'cartaz', 'relogio', 'tabela_periodica', 'cartaz_dna', 'cesta', 'quadro', 'janela', 'mural', 'cardapio'];

/**
 * Gera todas as texturas provisórias por código e registra no Phaser.
 * Se uma chave estiver em client/assets/sprites/overrides.json, a imagem do arquivo é usada no lugar
 * (veja client/assets/sprites/LEIA-ME.md).
 */
export function generateTextures(scene, data, overrideKeys = new Set()) {
  const tm = scene.textures;
  const add = (key, canvas, frameW = 0, frameH = 0) => {
    if (overrideKeys.has(key)) return;
    if (tm.exists(key)) tm.remove(key);
    const tex = tm.addCanvas(key, canvas);
    if (frameW) {
      const n = Math.floor(canvas.width / frameW);
      for (let i = 0; i < n; i++) tex.add(i, 0, i * frameW, 0, frameW, frameH);
    }
  };

  // Personagens (inclui os ainda bloqueados, para os cards) e chefes da coordenação
  for (const c of data.characterList) add('char_' + c.id, drawCharacterSheet(c.visual, c.color), 32, 32);
  for (const b of data.bosses) add('char_' + b.id, drawCharacterSheet(b.visual, '#e03a3a'), 32, 32);

  // Inimigos
  add('enemy_caderno_zumbi', drawCadernoZumbi(), 32, 32);
  add('enemy_prova_voadora', drawProvaVoadora(), 32, 32);
  add('enemy_estojo', drawEstojo(), 32, 32);
  add('enemy_maquina_xerox', drawXerox(), 64, 64);
  add('enemy_lousa', drawLousaEnemy(), 32, 32);
  add('enemy_sinal_recreio', drawSinal(), 32, 32);
  add('enemy_mochila', drawMochila(), 32, 32);
  add('enemy_diva', drawDiva(), 48, 40);
  add('enemy_caderno_preto', drawCadernoPreto(), 44, 44);
  drawAlunos().forEach((sheet, i) => add('aluno_' + i, sheet, 32, 32));
  add('char_cantineira', drawCantineira(), 32, 32);

  // Armas e projéteis (lidos do weapons.json — armas novas ganham sprite automaticamente)
  for (const w of data.weapons.values()) {
    add('wpn_' + w.id, drawWeapon(w.sprite.shape, w.sprite.color, w.sprite.accent));
    if (w.projectile) {
      const s = w.projectile.sprite;
      add('proj_' + w.id, drawProjectile(s.shape, s.color, s.accent));
      for (const v of w.variants?.list || []) add(v.spriteKey, drawProjectile(v.sprite.shape, v.sprite.color, v.sprite.accent));
      if (w.projectile.glyphs) {
        for (const ch of w.projectile.glyphs) add('glyph_' + ch.codePointAt(0), drawGlyph(ch, s.color, s.accent));
      }
    }
  }
  add('proj_nota_mil', drawNotaMil());
  add('proj_semente', drawProjectile('seed', '#7be04a', '#2f8a1f'));
  for (const st of ['paper', 'pencil', 'toner']) add('ebullet_' + st, drawEnemyBullet(st));
  for (const st of ['chalk', 'wave', 'paper_red']) add('ebullet_' + st, drawExtraBullet(st));

  // Cenário: caixas, barris, espinhos, decoração, estátua, cela, planta, bolha de letras
  add('prop_caixa', drawCrate());
  add('prop_barril', drawBarrel());
  for (let i = 0; i < 3; i++) add('spikes_' + i, drawSpikes(i));
  for (const k of DECOR_KINDS) add('decor_' + k, drawDecor(k));
  add('statue', drawStatue());
  add('cage', drawCage());
  add('ally_planta', drawPlant(), 32, 32);
  add('ally_turret', drawTurret());
  add('ally_mine', drawMine(), 16, 16);
  add('letters', drawLetters());

  // Itens e cenário
  add('chest_closed', drawChest(false));
  add('chest_open', drawChest(true));
  add('heal_station', drawHealStation(false));
  add('heal_station_used', drawHealStation(true));
  add('portal', drawPortalFrames(), 48, 48);
  add('energy', drawEnergyOrb());
  add('coin', drawCoin());
  add('apple', drawApple());
  add('shadow', drawShadow());
  add('spawn_circle', drawSpawnCircle());
  add('crosshair', drawCrosshair());
  add('door_bar', drawDoorBar());
  add('px', drawPixel());
  add('soft', drawSoftCircle(32));
  for (const k of ['heart', 'shield', 'energy', 'coin', 'lock']) add('icon_' + k, drawIcon(k));
  add('tiles', buildTileset());

  createAnimations(scene, data);
}

function createAnimations(scene, data) {
  const A = scene.anims;
  const mk = (key, tex, frames, frameRate, repeat = -1) => {
    if (A.exists(key)) A.remove(key);
    A.create({ key, frames: frames.map((f) => ({ key: tex, frame: f })), frameRate, repeat });
  };
  const all = [...data.characterList, ...data.bosses];
  for (const c of all) {
    const tex = 'char_' + c.id;
    mk(tex + '_idle', tex, [0, 1], 3);
    mk(tex + '_walk', tex, CHAR_FRAMES >= 6 ? [2, 3, 4, 5] : [0, 1], 10);
  }
  for (const e of ['caderno_zumbi', 'prova_voadora', 'estojo', 'lousa', 'sinal_recreio', 'mochila', 'diva', 'caderno_preto']) mk('enemy_' + e + '_move', 'enemy_' + e, [0, 1], 6);
  for (let i = 0; i < 4; i++) mk('aluno_' + i + '_walk', 'aluno_' + i, [2, 3, 4, 5], 10);
  mk('enemy_estojo_closed', 'enemy_estojo', [2, 3], 4);
  mk('char_cantineira_idle', 'char_cantineira', [0, 1], 3);
  mk('ally_planta_bite', 'ally_planta', [0, 1], 5);
  mk('enemy_maquina_xerox_move', 'enemy_maquina_xerox', [0, 1], 4);
  mk('enemy_maquina_xerox_angry', 'enemy_maquina_xerox', [2, 1], 8);
  mk('portal_spin', 'portal', [0, 1, 2, 3, 4, 5, 6, 7], 12);
}
