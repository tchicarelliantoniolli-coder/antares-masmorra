// Página de conferência dos sprites provisórios (abra /galeria.html).
import { drawCharacterSheet } from './render/characterArt.js';
import { drawCadernoZumbi, drawProvaVoadora, drawEstojo, drawXerox, drawBorracha, drawGrampeador, drawReguaMira, drawApontador, drawMonitor, drawGremio, drawChamada, drawProjectile, drawGlyph, drawNotaMil, drawEnemyBullet } from './render/enemyArt.js';
import { drawWeapon, drawChest, drawHealStation, drawPortalFrames, drawApple, drawCoin, drawEnergyOrb, drawDoorBar } from './render/itemArt.js';
import { buildTileset } from './render/tileArt.js';

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
r = section('Tileset (linhas: sala de aula, laboratório, quadra, biblioteca, pátio, secretaria, corredor)');
show(r, buildTileset(), 'tiles', 2);
