import { TILE, T, TRAP_PERIOD, TRAP_UP_AT } from '../constants.js';
import { dropEnergy, dropCoins } from './Pickups.js';
import { explode, hurtPlayer, damageEnemy } from '../combat.js';

/**
 * Objetos destrutíveis e barris explosivos (tiles T.PROP) + espinhos no chão.
 * Os objetos vêm do tema da sala (themes.json -> props: mochila, pilha_livros, vaso...): todos agem como a caixa
 * (4 de vida, podem soltar energia/moedas); só o 'barril' explode. Quem desenha cada um é o cliente (prop_<kind>).
 * Projéteis (dos dois times), golpes corpo a corpo e explosões danificam os objetos.
 */

export function propAt(world, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (world.map.get(tx, ty) !== T.PROP) return null;
  return { tx, ty, idx: world.map.idx(tx, ty) };
}

export function damageProp(world, tx, ty, dmg) {
  const map = world.map;
  const idx = map.idx(tx, ty);
  const p = map.props.get(idx);
  if (!p) return;
  p.hp -= dmg;
  world.emit('prop_hit', { idx, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
  if (p.hp <= 0) breakProp(world, tx, ty);
}

export function breakProp(world, tx, ty) {
  const map = world.map;
  const idx = map.idx(tx, ty);
  const p = map.props.get(idx);
  if (!p) return;
  map.props.delete(idx);
  map.set(tx, ty, T.FLOOR);
  const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
  world.emit('prop_break', { idx, kind: p.kind, x, y });
  if (p.kind === 'barril') {
    explode(world, x, y, 70, 8, { hurtsPlayers: true, style: 'barrel' }); // pode explodir outros barris (cadeia)
  } else if (world.rng.chance(0.35)) {
    if (world.rng.chance(0.6)) dropEnergy(world, x, y, world.rng.int(1, 2));
    else dropCoins(world, x, y, world.rng.int(1, 2));
  }
}

export function damagePropsInRadius(world, x, y, r, dmg) {
  const map = world.map;
  const t0x = Math.floor((x - r) / TILE), t1x = Math.floor((x + r) / TILE);
  const t0y = Math.floor((y - r) / TILE), t1y = Math.floor((y + r) / TILE);
  const hits = [];
  for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
    if (map.get(tx, ty) !== T.PROP) continue;
    if (Math.hypot((tx + 0.5) * TILE - x, (ty + 0.5) * TILE - y) <= r + TILE * 0.5) hits.push([tx, ty]);
  }
  for (const [tx, ty] of hits) damageProp(world, tx, ty, dmg);
}

/** Estado de um espinho no tempo t: 0 = abaixado, 1 = avisando, 2 = para cima. */
export function trapState(trap, t) {
  const c = (t + trap.phase) % TRAP_PERIOD;
  if (c >= TRAP_UP_AT) return 2;
  if (c >= TRAP_UP_AT - 0.4) return 1;
  return 0;
}

export function updateTraps(world) {
  const traps = world.map.traps;
  if (!traps.length) return;
  const t = world.time;
  for (const p of world.players) {
    if (p.dead || p.downed || p.jailTimer > 0) continue;
    const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y + 6) / TILE);
    for (const tr of traps) {
      if (tr.tx === tx && tr.ty === ty && trapState(tr, t) === 2) { hurtPlayer(world, p, 1); break; }
    }
  }
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.def.flying || e.def.boss || e.def.invulnerable) continue;
    e.trapCd = (e.trapCd || 0) - 1 / 60;
    if (e.trapCd > 0) continue;
    const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
    for (const tr of traps) {
      if (tr.tx === tx && tr.ty === ty && trapState(tr, t) === 2) { damageEnemy(world, e, 3, { noMul: true }); e.trapCd = 1; break; }
    }
  }
}
