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
  await page.evaluate((c) => {
    const g = window.__game;
    g.scene.getScenes(true).forEach((sc) => sc.scene.stop());
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
