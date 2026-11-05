// Uso: node scripts/bot/run.mjs --root <pasta do jogo> --profile dupla --players 2 --runs 30 [--seed0 1]
// Importa World e loadGameDataNode de <root>/shared/sim/ (permite rodar contra a v0.2 num worktree).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROFILES, runMatch } from './bot.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const root = path.resolve(args.root || '.');
const profileName = args.profile || 'experiente';
const players = Number(args.players || 1), runs = Number(args.runs || 30), seed0 = Number(args.seed0 || 1);
const profile = PROFILES[profileName];
if (!profile) { console.error('perfil desconhecido:', profileName); process.exit(1); }

const imp = (f) => import(pathToFileURL(path.join(root, 'shared/sim', f)).href);
const { World } = await imp('World.js');
const { loadGameDataNode } = await imp('loadDataNode.js');
const data = loadGameDataNode();

const res = [];
for (let i = 0; i < runs; i++) {
  const t0 = Date.now();
  const r = runMatch({ World, data, seed: seed0 + i, players, profile });
  res.push(r);
  if (r.error) console.error(`seed ${seed0 + i}: erro na simulação: ${r.error}`);
  if (args.verbose) console.log(`seed ${seed0 + i}: ${r.reason} andar ${r.floor} ${r.seconds.toFixed(0)}s (${Date.now() - t0} ms)`);
}
const wins = res.filter((r) => r.victory).length;
const avg = (f) => res.reduce((s, r) => s + f(r), 0) / res.length;
const reasons = {};
for (const r of res) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
const byFloor = {};
for (const r of res.filter((x) => !x.victory)) byFloor[`${r.reason}@${r.floor}`] = (byFloor[`${r.reason}@${r.floor}`] || 0) + 1;
console.log(`root=${root} perfil=${profileName} jogadores=${players} partidas=${runs}`);
console.table({
  'vitórias': `${wins}/${runs} (${((100 * wins) / runs).toFixed(0)}%)`,
  'andar médio': avg((r) => r.floor).toFixed(2),
  'tempo médio (s)': avg((r) => r.seconds).toFixed(0),
  'motivos': JSON.stringify(reasons),
  'derrotas (motivo@andar)': JSON.stringify(byFloor)
});
