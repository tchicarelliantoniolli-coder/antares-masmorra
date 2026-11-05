#!/usr/bin/env node
/**
 * Teste de fumaça no navegador (Playwright). Precisa do servidor rodando (npm start).
 *   node scripts/smoke.mjs [--url http://localhost:3000] [--only nome] [--shots pasta]
 * Sai com código 0 se todos os cenários passarem.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/pw-browsers/../playwright'); }

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const URL_ = opt('url', 'http://localhost:3000');
const ONLY = opt('only', null);
const SHOTS = opt('shots', null);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const GAME_W = 960, GAME_H = 540;

async function launch() {
  try { return await playwright.chromium.launch(); } catch { return playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }
}

async function openGame(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL_);
  await waitScene(page, 'Menu', 15000);
  return { page, errors };
}

async function waitScene(page, key, timeout = 3000) {
  await page.waitForFunction((k) => window.__game && window.__game.scene.isActive(k), key, { timeout });
}

/** Clica num ponto em coordenadas do jogo (GAME_W x GAME_H). */
async function clickGame(page, gx, gy) {
  const r = await page.evaluate(() => { const b = window.__game.canvas.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.mouse.click(r.x + (gx / GAME_W) * r.w, r.y + (gy / GAME_H) * r.h);
}

export const SCENARIOS = {
  /** Sair do menu e voltar: os botões precisam continuar funcionando. */
  async 'menu-volta'(browser) {
    const { page, errors } = await openGame(browser);
    await page.waitForTimeout(400);
    await clickGame(page, GAME_W / 2, 240); // JOGAR SOLO
    await waitScene(page, 'CharacterSelect');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await waitScene(page, 'Menu');
    await page.waitForTimeout(400);
    await clickGame(page, GAME_W / 2, 240);
    await waitScene(page, 'CharacterSelect', 2000);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'menu-volta.png') });
    await page.close();
    return errors;
  }
};

/** Começa uma partida solo direto (sem clicar nos menus). */
async function startSolo(page, characterId = 'harilson') {
  await page.evaluate(() => window.__game.scene.getScenes(true).forEach((sc) => sc.scene.stop()));
  await page.waitForTimeout(250);
  await page.evaluate((c) => {
    const g = window.__game;
    g.scene.start('Game', { mode: 'solo', players: [{ id: 'p1', characterId: c, name: 'Jogador 1', device: 'auto' }] });
  }, characterId);
  await waitScene(page, 'Game', 5000);
  await page.waitForTimeout(600);
}

SCENARIOS['partida-solo'] = async (browser) => {
  const { page, errors } = await openGame(browser);
  await startSolo(page);
  await clickGame(page, GAME_W / 2 + 200, GAME_H / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  const shots = await page.evaluate(() => window.__game.scene.getScene('Game').world.stats.shots);
  if (!(shots > 0)) errors.push('nenhum tiro disparado segurando o mouse');
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'partida-solo.png') });
  await page.close();
  return errors;
};

/** Galeria: todos os sprites (inclusive armas novas) são gerados sem erro. */
SCENARIOS['galeria'] = async (browser) => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL_ + '/galeria.html');
  await page.waitForTimeout(2500);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'galeria.png'), fullPage: true });
  await page.close();
  return errors;
};

/** Uma arma de cada modo: segura atirar, solta, troca. Falha se der erro no console. */
const WEAPON_SAMPLES = ['canhao_protons', 'arco_alfabeto', 'metralhadora_borrachas', 'folhas_redacao', 'bico_bunsen', 'catapulta_mini',
  'livro_magico', 'raios_eletricos', 'tachinhas_chao', 'ventilador_teto', 'mini_buraco_negro', 'baloes_ingles', 'bolas_esportes',
  'dna_celulas', 'pincel_tinta', 'lanca_romana', 'regua_espada', 'guarda_chuva', 'taco_beisebol'];

SCENARIOS['armas'] = async (browser) => {
  const { page, errors } = await openGame(browser);
  await startSolo(page, 'jean_paulo');
  for (const id of WEAPON_SAMPLES) {
    await page.evaluate((wid) => {
      const p = window.__game.scene.getScene('Game').world.players[0];
      p.weapons = [wid]; p.cur = 0; p.energy = p.maxEnergy; p.fireCd = 0;
    }, id);
    await clickGame(page, GAME_W / 2 + 160, GAME_H / 2 - 20);
    await page.mouse.down();
    await page.waitForTimeout(id === 'arco_alfabeto' ? 900 : 450);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, 'arma-' + id + '.png') });
    await page.mouse.up();
    await page.waitForTimeout(350);
    if (SHOTS && ['catapulta_mini', 'livro_magico', 'mini_buraco_negro', 'pincel_tinta'].includes(id)) await page.screenshot({ path: join(SHOTS, 'arma-' + id + '-depois.png') });
  }
  await page.close();
  return errors;
};

/** Os 14 professores: começa solo, usa a habilidade e atira 1 s; qualquer erro no console falha. */
SCENARIOS['professores'] = async (browser) => {
  const { page, errors } = await openGame(browser);
  const lista = await page.evaluate(() => window.__game.registry.get('data').characterList.map((c) => c.id));
  for (const id of lista) {
    try { await startSolo(page, id); } catch (e) { errors.push(id + ': ' + e.message.split('\n')[0] + ' | ' + (await page.evaluate(() => window.__game.scene.getScenes(true).map((x) => x.scene.key).join(','))).toString()); break; }
    // um alvo parado perto, para toda arma (inclusive de raio) ter o que atingir
    await page.evaluate(async () => {
      const { createEnemy } = await import('/shared/sim/inimigos/Enemy.js');
      const w = window.__game.scene.getScene('Game').world, p = w.players[0];
      const e = createEnemy(w, 'caderno_zumbi', p.x + 120, p.y, -1, { spawnTime: 0 });
      e.hp = e.maxHp = 9999; e.cd = 999;
      e.def = { ...e.def, behavior: 'none', contactDamage: 0, drops: {} };
    });
    await clickGame(page, GAME_W / 2 + 200, GAME_H / 2);
    await page.keyboard.press('Space');
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.mouse.up();
    const r = await page.evaluate(() => { const w = window.__game.scene.getScene('Game').world; return { shots: w.stats.shots, cd: w.players[0].skillCd }; });
    if (!(r.shots > 0)) errors.push(id + ': nenhum tiro');
    if (!(r.cd > 0)) errors.push(id + ': habilidade não entrou em recarga');
  }
  if (lista.length !== 14) errors.push('esperava 14 professores, achei ' + lista.length);
  await page.close();
  return errors;
};

/** Online com dois navegadores: o segundo vê o laser do Jean Paulo e a carga da Marina do primeiro. */
SCENARIOS['online'] = async (browser) => {
  const ctxA = await browser.newContext(), ctxB = await browser.newContext();
  const open = async (ctx) => {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(URL_);
    await waitScene(page, 'Menu', 15000);
    await page.waitForTimeout(300);
    await clickGame(page, GAME_W / 2, 332); // ONLINE (SALAS)
    await waitScene(page, 'OnlineMenu');
    return { page, errors };
  };
  const A = await open(ctxA), B = await open(ctxB);
  await A.page.fill('#nome', 'Ana');
  await A.page.click('#criar');
  await waitScene(A.page, 'Lobby', 5000);
  await A.page.waitForFunction(() => window.__game.scene.getScene('Lobby').client.code, null, { timeout: 5000 });
  const code = await A.page.evaluate(() => window.__game.scene.getScene('Lobby').client.code);
  await B.page.fill('#nome', 'Beto');
  await B.page.fill('#code', code);
  await B.page.click('#entrar');
  await waitScene(B.page, 'Lobby', 5000);
  await A.page.evaluate(() => window.__game.scene.getScene('Lobby').client.setCharacter('jean_paulo'));
  await B.page.evaluate(() => window.__game.scene.getScene('Lobby').client.setCharacter('marina'));
  await A.page.waitForTimeout(300);
  for (const P of [A, B]) await P.page.evaluate(() => window.__game.scene.getScene('Lobby').client.setReady(true));
  await waitScene(A.page, 'Game', 8000);
  await waitScene(B.page, 'Game', 8000);
  await A.page.waitForTimeout(800);
  // A segura o laser; B segura a carga
  for (const P of [A, B]) { await clickGame(P.page, GAME_W / 2 + 160, GAME_H / 2); await P.page.mouse.down(); }
  await A.page.waitForTimeout(700);
  const seen = await B.page.evaluate(() => {
    const w = window.__game.scene.getScene('Game').world;
    const me = w.players.find((p) => p.name === 'Beto');
    return { beams: w.beams.length, charge: me?.wstate?.charge || 0 };
  });
  if (SHOTS) { await A.page.screenshot({ path: join(SHOTS, 'online-A.png') }); await B.page.screenshot({ path: join(SHOTS, 'online-B.png') }); }
  for (const P of [A, B]) await P.page.mouse.up();
  const errors = [...A.errors, ...B.errors];
  if (!(seen.beams > 0)) errors.push('o segundo navegador não recebeu o laser do primeiro');
  if (!(seen.charge > 0)) errors.push('a carga da Marina não chegou pelo snapshot');
  await ctxA.close(); await ctxB.close();
  return errors;
};

const browser = await launch();
let failed = 0;
for (const [name, fn] of Object.entries(SCENARIOS)) {
  if (ONLY && name !== ONLY) continue;
  try {
    const errors = await fn(browser);
    if (errors.length) { failed++; console.log(`FAIL ${name}\n  ` + errors.join('\n  ')); }
    else console.log(`ok ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
