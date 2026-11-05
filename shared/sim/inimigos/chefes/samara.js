import { moveToward, enemyShoot, createEnemy } from '../Enemy.js';
import { createArea } from '../../areas.js';
import { TILE } from '../../constants.js';
import { toIdle, bossRoom, targetablePlayers, keepDistance } from './common.js';

/**
 * Samara S. de A. Peres — Coordenadora Pedagógica (chefe final, Andar 3). 3 fases.
 *  - "Advertência": leques de papel vermelho.
 *  - "Caderno Preto": um caderno gigante persegue um jogador; quem é pego fica "assinando"
 *    (sem atacar nem andar) até um colega ficar perto dele por 1 segundo.
 *  - "Suspensão": prende um jogador numa cela por alguns segundos, fora da luta.
 *  - Fase 2: mais rápida e chama provas voadoras. Fase 3: Caderno Preto + Advertência ao mesmo tempo.
 */
const P1 = { advertencia: 3, caderno: 2, suspensao: 1 };
const P2 = { advertencia: 3, caderno: 2, suspensao: 2, provas: 1 };
const P3 = { combo: 4, advertencia: 2, suspensao: 1 };

export function bossSamara(world, b, dt, target) {
  if (!b.state || b.state === 'move') { toIdle(b, 1.4); b.phase = 1; }
  if (b.phase === 1 && b.hp <= b.maxHp * 0.66) {
    b.phase = 2; b.phase2 = true;
    toIdle(b, 1);
    world.emit('boss_phase', { id: b.id, phase: 2, name: b.def.name, text: 'ISSO VAI PARA O SEU REGISTRO!' });
  } else if (b.phase === 2 && b.hp <= b.maxHp * 0.33) {
    b.phase = 3;
    toIdle(b, 1);
    world.emit('boss_phase', { id: b.id, phase: 3, name: b.def.name, text: 'REUNIÃO DE PAIS: FASE FINAL!' });
  }
  const spd = b.phase === 3 ? 1.35 : b.phase === 2 ? 1.15 : 1;
  if (!target) {
    b.t -= dt;
    return;
  }
  b.facing = target.x > b.x ? 1 : -1;

  switch (b.state) {
    case 'idle':
      keepDistance(world, b, target, dt, b.def.speed * spd, 140, 240, moveToward);
      b.t -= dt;
      if (b.t <= 0) choose(world, b);
      break;
    case 'advertencia':
    case 'combo':
      b.t -= dt;
      keepDistance(world, b, target, dt, b.def.speed * spd * 0.6, 140, 260, moveToward);
      if (b.t <= 0) {
        const n = b.phase === 3 ? 8 : 7;
        const spread = b.phase === 3 ? 84 : 72; // vãos largos o bastante para desviar
        enemyShoot(world, b, Math.atan2(target.y - b.y, target.x - b.x), { bullets: n, spread, speed: 175, damage: 1, style: 'paper_red', noExtra: true });
        b.count--;
        b.t = (b.state === 'combo' ? 0.85 : 0.7) / spd;
        if (b.count <= 0) toIdle(b, 1.4 / spd);
      }
      break;
    default:
      b.t -= dt;
      if (b.t <= 0) toIdle(b, 0.9 / spd);
  }
}

function choose(world, b) {
  const base = b.phase === 3 ? P3 : b.phase === 2 ? P2 : P1;
  const pool = { ...base };
  if (b.lastAttack && b.lastAttack !== 'combo') pool[b.lastAttack] = 0;
  const notebook = world.enemies.some((e) => e.type === 'caderno_preto' && !e.dead);
  if (notebook) pool.caderno = 0;
  const free = targetablePlayers(world);
  if (!free.length || world.players.some((p) => p.jailTimer > 0)) pool.suspensao = 0;
  if (minionCount(world) >= 2) pool.provas = 0;
  // Se as restrições zeraram tudo, volta aos pesos da fase (menos o último ataque); sem nada, advertência.
  if (!Object.values(pool).some((w) => w > 0)) {
    for (const k of Object.keys(base)) pool[k] = k === b.lastAttack ? 0 : base[k];
    if (!free.length) pool.suspensao = 0; // sem jogador livre não dá para prender ninguém
    if (!Object.values(pool).some((w) => w > 0)) pool.advertencia = 1;
  }
  const atk = world.rng.weighted(pool);
  b.lastAttack = atk;
  world.emit('boss_attack', { id: b.id, attack: atk });
  switch (atk) {
    case 'advertencia':
      b.state = 'advertencia'; b.count = b.phase === 1 ? 2 : 3; b.t = 0.45;
      world.emit('boss_say', { id: b.id, text: 'ADVERTÊNCIA!' });
      break;
    case 'combo':
      if (!notebook) spawnNotebook(world, b);
      b.state = 'combo'; b.count = 3; b.t = 0.6;
      break;
    case 'caderno':
      spawnNotebook(world, b);
      b.state = 'wait'; b.t = 0.8;
      break;
    case 'suspensao': {
      const v = world.rng.pick(free);
      const room = bossRoom(world, b);
      const solo = world.players.filter((p) => !p.dead).length === 1;
      v.jailFrom = { x: v.x, y: v.y };
      v.jailTimer = solo ? 2.5 : 4.5;
      const cx = (room.x0 + 2.5) * TILE, cy = (room.y0 + 2.5) * TILE;
      v.x = cx; v.y = cy;
      createArea(world, 'cela', cx, cy, { r: 26, life: v.jailTimer, targetId: v.id });
      world.emit('jail', { id: v.id, x: cx, y: cy });
      world.emit('boss_say', { id: b.id, text: 'SUSPENSÃO! Para a coordenação, já!' });
      if (solo && minionCount(world) < 2) createEnemy(world, 'prova_voadora', b.x + 40, b.y + 30, b.roomId, { spawnTime: 0.6, minion: true, atkMul: 1.5, life: 12 });
      b.state = 'wait'; b.t = 1;
      break;
    }
    case 'provas':
      for (let i = 0; i < 2 && minionCount(world) < 3; i++) createEnemy(world, 'prova_voadora', b.x + (i ? 50 : -50), b.y + 40, b.roomId, { spawnTime: 0.6, minion: true, atkMul: 1.5, life: 12 });
      b.state = 'wait'; b.t = 0.8;
      break;
  }
}

function spawnNotebook(world, b) {
  const free = targetablePlayers(world);
  const v = free.length ? world.rng.pick(free) : null;
  createEnemy(world, 'caderno_preto', b.x, b.y - 30, b.roomId, { spawnTime: 0.5, minion: true, targetId: v?.id });
  world.emit('boss_say', { id: b.id, text: 'Seu nome vai para o CADERNO PRETO!' });
}

function minionCount(world) {
  return world.enemies.filter((e) => e.minion && e.type === 'prova_voadora' && !e.dead).length;
}
