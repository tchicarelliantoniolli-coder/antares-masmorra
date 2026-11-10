// Carrega os JSON do disco (usado pelo servidor Node e pelos testes).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { GameData } from './data.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');

export function readJson(name) {
  return JSON.parse(readFileSync(path.join(dataDir, name), 'utf8'));
}

export function loadGameDataNode() {
  return new GameData({
    weapons: readJson('weapons.json'),
    characters: readJson('characters.json'),
    enemies: readJson('enemies.json'),
    themes: readJson('themes.json')
  });
}
