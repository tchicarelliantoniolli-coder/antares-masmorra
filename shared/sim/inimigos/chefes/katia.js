import { moveToward, enemyShoot, createEnemy } from '../Enemy.js';
import { createArea } from '../../areas.js';
import { TILE } from '../../constants.js';
import { toIdle, bossRoom, freePointInRoom, targetablePlayers, keepDistance } from './common.js';

/**
 * Katia da Vinha Tornisielo — Orientadora Pedagógica e Psicóloga (chefe do Andar 2). 2 fases.
 *  - "Como você está se sentindo?": ondas de choque em anel que deixam lento.
 *  - "Assembleia": uma roda de alunos fecha e empurra todos para o centro da sala.
 *  - "Conversa Particular": puxa um jogador para perto dela, dentro de um círculo fechado.
 *  - "Anotações": rajadas de papel mirando o jogador.
 *  - Fase 2: "Divã" — cria um divã que a cura até alguém destruí-lo.
 */
const P1 = { sentimento: 3, assembleia: 2, conversa: 2, anotacoes: 3 };
const P2 = { sentimento: 3, assembleia: 2, conversa: 3, anotacoes: 2, diva: 3 };

export function bossKatia(world, b, dt, target) {
  if (!b.state || b.state === 'move') toIdle(b, 1.4);
  if (!b.phase2 && b.hp <= b.maxHp * 0.5) {
    b.phase2 = true;
    b.phase = 2;
    toIdle(b, 1);
    world.emit('boss_phase', { id: b.id, phase: 2, name: b.def.name, text: 'VAMOS CONVERSAR SOBRE ISSO...' });
    spawnDiva(world, b);
  }
  const spd = b.phase2 ? 1.3 : 1;
  if (!target) return;
  b.facing = target.x > b.x ? 1 : -1;

  switch (b.state) {
    case 'idle':
      keepDistance(world, b, target, dt, b.def.speed * spd, 130, 230, moveToward);
      b.t -= dt;
      if (b.t <= 0) choose(world, b, target);
      break;
    case 'sentimento':
      b.t -= dt;
      if (b.t <= 0) {
        // anel com uma abertura (dá para passar por ela!)
        const n = b.phase2 ? 24 : 20;
        const gap = world.rng.range(0, Math.PI * 2);
        for (let i = 0; i < n; i++) {
          const a = gap + 0.55 + (i / n) * (Math.PI * 2 - 1.1);
          enemyShoot(world, b, a, { bullets: 1, spread: 0, speed: 125 * spd, damage: 1, style: 'wave', slow: 1.2, noExtra: true });
        }
        world.emit('bell', { x: b.x, y: b.y, katia: true });
        b.count--;
        b.t = 0.65 / spd;
        if (b.count <= 0) toIdle(b, 1.1 / spd);
      }
      break;
    case 'anotacoes':
      b.t -= dt;
      if (b.t <= 0) {
        enemyShoot(world, b, Math.atan2(target.y - b.y, target.x - b.x), { bullets: b.phase2 ? 5 : 3, spread: 30, speed: 200, damage: 1, style: 'paper', noExtra: true });
        b.count--;
        b.t = 0.35;
        if (b.count <= 0) toIdle(b, 0.9 / spd);
      }
      break;
    case 'assembleia':
      // durante a roda, ela atira devagar no alvo
      b.t -= dt;
      b.shotT = (b.shotT || 0) - dt;
      if (b.shotT <= 0) {
        b.shotT = 0.9;
        enemyShoot(world, b, Math.atan2(target.y - b.y, target.x - b.x), { bullets: 1, spread: 0, speed: 170, damage: 1, style: 'paper', noExtra: true });
      }
      if (b.t <= 0) toIdle(b, 1);
      break;
    case 'conversa':
      b.t -= dt;
      b.shotT = (b.shotT || 0) - dt;
      if (b.shotT <= 0) {
        b.shotT = 0.8 / spd;
        const victim = world.players.find((p) => p.id === b.victimId);
        const tx = victim ? victim.x : target.x, ty = victim ? victim.y : target.y;
        enemyShoot(world, b, Math.atan2(ty - b.y, tx - b.x), { bullets: 3, spread: 40, speed: 150, damage: 1, style: 'wave', noExtra: true });
      }
      if (b.t <= 0) toIdle(b, 1);
      break;
    default:
      b.t -= dt;
      if (b.t <= 0) toIdle(b, 0.8);
  }
}

function choose(world, b, target) {
  const pool = { ...(b.phase2 ? P2 : P1) };
  if (b.lastAttack) pool[b.lastAttack] = 0;
  if (world.enemies.some((e) => e.type === 'diva' && !e.dead)) pool.diva = 0;
  if (world.enemies.some((e) => e.type === 'aluno' && !e.dead)) pool.assembleia = 0;
  if (!targetablePlayers(world).length) pool.conversa = 0;
  const atk = world.rng.weighted(pool);
  b.lastAttack = atk;
  world.emit('boss_attack', { id: b.id, attack: atk });
  const room = bossRoom(world, b);
  switch (atk) {
    case 'sentimento':
      b.state = 'sentimento'; b.count = b.phase2 ? 4 : 3; b.t = 0.4;
      world.emit('boss_say', { id: b.id, text: 'Como você está se sentindo?' });
      break;
    case 'anotacoes':
      b.state = 'anotacoes'; b.count = 4; b.t = 0.3;
      break;
    case 'assembleia': {
      b.state = 'assembleia'; b.t = 5.5;
      const cx = (room.cx + 0.5) * TILE, cy = (room.cy + 0.5) * TILE;
      const R = (Math.min(room.w, room.h) / 2 - 2) * TILE;
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const ax = cx + Math.cos(a) * R * (room.w / room.h), ay = cy + Math.sin(a) * R;
        createEnemy(world, 'aluno', ax, ay, b.roomId, { spawnTime: 0.6, minion: true, cx, cy, stopR: 80 });
      }
      world.emit('boss_say', { id: b.id, text: 'ASSEMBLEIA! Todo mundo no centro!' });
      break;
    }
    case 'conversa': {
      const victims = targetablePlayers(world);
      const v = world.rng.pick(victims);
      b.victimId = v.id;
      b.state = 'conversa'; b.t = 4.5;
      const a = Math.atan2(v.y - b.y, v.x - b.x);
      v.pull = { x: b.x + Math.cos(a) * 55, y: b.y + Math.sin(a) * 55, t: 0.6 };
      createArea(world, 'private_circle', b.x, b.y, { r: 100, life: 4.5, targetId: v.id, bossId: b.id });
      world.emit('boss_say', { id: b.id, text: 'Podemos ter uma conversa particular?' });
      break;
    }
    case 'diva':
      spawnDiva(world, b);
      b.state = 'wait'; b.t = 0.6;
      break;
  }
}

function spawnDiva(world, b) {
  const room = bossRoom(world, b);
  const [x, y] = freePointInRoom(world, room, b.x, b.y, 160);
  createEnemy(world, 'diva', x, y, b.roomId, { spawnTime: 0.8, minion: true });
  world.emit('boss_say', { id: b.id, text: 'Deite no divã... (destrua o divã!)' });
}
