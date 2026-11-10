// Página de conferência dos sprites provisórios (abra /galeria.html).
import { drawCharacterSheet } from './render/characterArt.js';
import { drawCadernoZumbi, drawProvaVoadora, drawEstojo, drawXerox, drawBorracha, drawGrampeador, drawReguaMira, drawApontador, drawMonitor, drawGremio, drawChamada, drawProjectile, drawGlyph, drawNotaMil, drawEnemyBullet } from './render/enemyArt.js';
import { drawWeapon, drawChest, drawHealStation, drawPortalFrames, drawApple, drawCoin, drawEnergyOrb, drawDoorBar } from './render/itemArt.js';
import { buildTileset, buildShadowTileset, TILESET_COLS, TILE_KIND } from './render/tileArt.js';
import { drawProp, drawDecor } from './render/propArt.js';
import { decalSample } from './render/decals.js';
import { THEMES } from '/shared/sim/constants.js';
import { PROP_KINDS, DECOR_KINDS, DECOR_WIDTH, DECAL_KINDS } from '/shared/sim/salas/kinds.js';

const out = document.getElementById('out');
const section = (title) => {
  const h = document.createElement('h2'); h.textContent = title; out.appendChild(h);
  const r = document.createElement('div'); r.className = 'row'; out.appendChild(r); return r;
};
const show = (row, canvas, label, scale = 3) => {
  const d = document.createElement('div'); d.className = 'it';
  const c = document.createElement('canvas');
  c.width = canvas.width * scale; c.height = canvas.height * scale;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  d.appendChild(c);
  const s = document.createElement('div'); s.textContent = label; d.appendChild(s);
  row.appendChild(d);
};

const load = (n) => fetch('/shared/data/' + n).then((r) => r.json());
await document.fonts.load('14px "Press Start 2P"');
const [chars, weapons] = await Promise.all([load('characters.json'), load('weapons.json')]);

let r = section('Professores (char_<id>) — quadros: parado x2, andando x4');
for (const c of chars.characters) show(r, drawCharacterSheet(c.visual, c.color), c.shortName + ' — ' + c.subject, 3);
r = section('Coordenação (chefes dos andares 2 e 3)');
for (const b of chars.bosses) show(r, drawCharacterSheet(b.visual, '#e03a3a'), b.name, 3);
r = section('Inimigos');
show(r, drawCadernoZumbi(), 'enemy_caderno_zumbi', 3);
show(r, drawProvaVoadora(), 'enemy_prova_voadora', 3);
show(r, drawEstojo(), 'enemy_estojo', 3);
show(r, drawXerox(), 'enemy_maquina_xerox', 3);
show(r, drawBorracha(), 'enemy_borracha', 3);
show(r, drawGrampeador(), 'enemy_grampeador', 3);
show(r, drawReguaMira(), 'enemy_regua_mira', 3);
show(r, drawApontador(), 'enemy_apontador', 3);
show(r, drawMonitor(), 'enemy_monitor', 3);
show(r, drawGremio(), 'enemy_gremio', 3);
show(r, drawChamada(), 'enemy_chamada', 3);
r = section('Armas (wpn_<id>) e projéteis (proj_<id>)');
for (const w of weapons.weapons) {
  show(r, drawWeapon(w.sprite.shape, w.sprite.color, w.sprite.accent), w.name, 3);
  if (w.projectile) show(r, drawProjectile(w.projectile.sprite.shape, w.projectile.sprite.color, w.projectile.sprite.accent), 'proj', 3);
}
for (const ch of '7+×÷') show(r, drawGlyph(ch, '#ffe066', '#7a4b00'), 'glyph ' + ch, 3);
show(r, drawNotaMil(), 'proj_nota_mil', 2);
for (const s of ['paper', 'pencil', 'toner']) show(r, drawEnemyBullet(s), 'ebullet_' + s, 3);
r = section('Itens');
show(r, drawChest(false), 'chest_closed'); show(r, drawChest(true), 'chest_open');
show(r, drawHealStation(false), 'heal_station'); show(r, drawPortalFrames(), 'portal', 1);
show(r, drawApple(), 'apple'); show(r, drawCoin(), 'coin'); show(r, drawEnergyOrb(), 'energy'); show(r, drawDoorBar(), 'door_bar');
r = section('Tileset (10 temas x 8 tiles: chão A/B/C, topo e frente da parede, obstáculo A, chão D, obstáculo B)');
const tileset = buildTileset();
show(r, tileset, 'tiles', 2);

/** Recorta um tile do tileset. */
const tile = (theme, col) => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  c.getContext('2d').drawImage(tileset, col * 32, THEMES.indexOf(theme) * 32, 32, 32, 0, 0, 32, 32);
  return c;
};
r = section('Obstáculos por tema em fileira (A B A B) — ficam bonitos lado a lado');
for (const theme of THEMES) {
  const row = document.createElement('canvas'); row.width = 32 * 6; row.height = 32;
  const rctx = row.getContext('2d');
  for (let i = 0; i < 6; i++) rctx.drawImage(tile(theme, TILE_KIND.FLOOR_A), i * 32, 0);
  [TILE_KIND.OBSTACLE, TILE_KIND.OBSTACLE_B, TILE_KIND.OBSTACLE, TILE_KIND.OBSTACLE_B, TILE_KIND.OBSTACLE, TILE_KIND.OBSTACLE_B].forEach((k, i) => rctx.drawImage(tile(theme, k), i * 32, 0));
  show(r, row, theme, 2);
}
r = section('Pisos por tema (A B C D)');
for (const theme of THEMES) {
  const row = document.createElement('canvas'); row.width = 32 * 8; row.height = 32;
  const rctx = row.getContext('2d');
  [TILE_KIND.FLOOR_A, TILE_KIND.FLOOR_B, TILE_KIND.FLOOR_C, TILE_KIND.FLOOR_D, TILE_KIND.FLOOR_A, TILE_KIND.FLOOR_D, TILE_KIND.FLOOR_B, TILE_KIND.FLOOR_A].forEach((k, i) => rctx.drawImage(tile(theme, k), i * 32, 0));
  show(r, row, theme, 2);
}
r = section('Sombras no chão (tileset "shadows": 216 combinações de vizinhança, geradas por código)');
{
  const sh = buildShadowTileset();
  const bg = document.createElement('canvas'); bg.width = sh.width; bg.height = sh.height;
  const bctx = bg.getContext('2d'); bctx.fillStyle = '#c7955c'; bctx.fillRect(0, 0, bg.width, bg.height); bctx.drawImage(sh, 0, 0);
  show(r, bg, 'shadows sobre piso de sala de aula', 1);
}
r = section('Objetos quebráveis (prop_<kind>)');
for (const k of PROP_KINDS) show(r, drawProp(k), 'prop_' + k, 4);
r = section('Decoração de parede (decor_<kind>: largura em tiles x 32 px)');
for (const k of DECOR_KINDS) show(r, drawDecor(k), `decor_${k} (${DECOR_WIDTH[k]})`, DECOR_WIDTH[k] >= 3 ? 3 : 4);
r = section('Decalques de chão (opacidade final aplicada; a quadra aparece numa sala 19x15)');
const DECAL_THEME = { tapete: 'biblioteca', giz: 'sala_aula', papeis: 'secretaria', manchas: 'corredor', pegadas: 'corredor', derramado: 'laboratorio', poca: 'patio',
  rachaduras: 'patio', marcas_quadra: 'quadra', amarelinha: 'patio', folhas: 'patio', migalhas: 'cantina' };
for (const k of DECAL_KINDS) {
  const th = DECAL_THEME[k] || 'corredor';
  show(r, decalSample(k, th, THEMES.indexOf(th), tileset, 7), k + ' (' + th + ')', k === 'marcas_quadra' ? 1 : 2);
}
