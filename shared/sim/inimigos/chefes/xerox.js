import { moveToward, enemyShoot, createEnemy } from '../Enemy.js';
import { createArea } from '../../areas.js';


/**
 * A Máquina de Xerox (mini-chefe do Andar 1).
 * Ataques:
 *  - Cópia em Massa: anéis de papel em rajadas
 *  - Atolamento de Papel: avança em linha reta (com aviso); se bater na parede, fica atordoada e solta papel
 *  - Toner Derramado: lança toner que deixa poças que deixam lento
 *  - Fase 2 (50% de vida): Espiral de Papel e Cópias Piratas (invoca Provas Voadoras); fica mais rápida
 */
const ATTACKS_P1 = { burst: 3, jam: 2, toner: 2 };
const ATTACKS_P2 = { burst: 2, spiral: 3, jam: 2, toner: 2, summon: 2 };

export function bossXerox(world, b, dt, target) {
  if (!b.state || b.state === 'move') { b.state = 'idle'; b.t = 1.2; }
  if (!b.phase2 && b.hp <= b.maxHp * 0.5) {
    b.phase2 = true;
    b.state = 'idle';
    b.t = 1.2;
    b.telegraph = null;
    world.emit('boss_phase', { id: b.id, phase: 2, name: b.def.name, text: 'MODO TURBO: FRENTE E VERSO!' });
    enemyShoot(world, b, 0, { bullets: 24, spread: 360 - 15, speed: 150, damage: 1, style: 'paper' });
  }
  const spd = b.phase2 ? 1.35 : 1;
  if (!target) return;
  const angle = Math.atan2(target.y - b.y, target.x - b.x);
  b.facing = target.x > b.x ? 1 : -1;

  switch (b.state) {
    case 'idle': {
      const d = Math.hypot(target.x - b.x, target.y - b.y);
      if (d > 200) moveToward(world, b, target.x, target.y, b.def.speed * spd, dt);
      else if (d < 120) moveToward(world, b, target.x, target.y, b.def.speed * 0.6 * spd, dt, -1);
      b.t -= dt;
      if (b.t <= 0) chooseAttack(world, b, target);
      break;
    }
    case 'burst': {
      b.t -= dt;
      if (b.t <= 0) {
        const n = b.phase2 ? 16 : 14;
        const off = (b.burstsLeft % 2) * (Math.PI / n);
        enemyShoot(world, b, angle + off, { bullets: n, spread: 360 - 360 / n, speed: 165 * spd, damage: 1, style: 'paper' });
        b.burstsLeft--;
        b.t = 0.5 / spd;
        if (b.burstsLeft <= 0) toIdle(b, 1.1 / spd);
      }
      break;
    }
    case 'spiral': {
      b.t -= dt;
      b.spiralTimer -= dt;
      while (b.spiralTimer <= 0) {
        b.spiralTimer += 0.1;
        for (let k = 0; k < 3; k++) {
          enemyShoot(world, b, b.spiralAngle + (k * Math.PI * 2) / 3, { bullets: 1, spread: 0, speed: 160, damage: 1, style: 'paper', range: 640 });
        }
        b.spiralAngle += 0.3;
      }
      if (b.t <= 0) toIdle(b, 1.2);
      break;
    }
    case 'jam_windup': {
      b.t -= dt;
      if (b.t > 0.35) b.aim = angle; // trava a mira no fim do aviso
      b.telegraph = { type: 'line', angle: b.aim, length: 520, width: b.r * 2 };
      if (b.t <= 0) { b.state = 'jam_dash'; b.t = 1.0; b.telegraph = null; b.contactOverride = 2; world.emit('boss_dash', { id: b.id }); }
      break;
    }
    case 'jam_dash': {
      b.t -= dt;
      const sp = 520 * spd;
      const r = world.map.moveBox(b, Math.cos(b.aim) * sp * dt, Math.sin(b.aim) * sp * dt);
      if (r.hitX || r.hitY) {
        b.state = 'stunned';
        b.t = 1.4;
        b.contactOverride = undefined;
        world.emit('boss_crash', { x: b.x, y: b.y });
        enemyShoot(world, b, b.aim + Math.PI, { bullets: 10, spread: 160, speed: 190, damage: 1, style: 'paper' });
      } else if (b.t <= 0) {
        b.contactOverride = undefined;
        toIdle(b, 0.8);
      }
      break;
    }
    case 'stunned': {
      b.t -= dt;
      if (b.t <= 0) toIdle(b, 0.5);
      break;
    }
    case 'toner': {
      b.t -= dt;
      if (b.t <= 0) toIdle(b, 0.9);
      break;
    }
    case 'summon': {
      b.t -= dt;
      if (b.t <= 0) toIdle(b, 0.8);
      break;
    }
  }
}

function toIdle(b, t) {
  b.state = 'idle';
  b.t = t;
}

function chooseAttack(world, b, target) {
  const pool = { ...(b.phase2 ? ATTACKS_P2 : ATTACKS_P1) };
  if (b.lastAttack) pool[b.lastAttack] = 0;
  const minions = world.enemies.filter((e) => e.minion && !e.dead).length;
  if (minions >= 3) pool.summon = 0;
  const atk = world.rng.weighted(pool);
  b.lastAttack = atk;
  world.emit('boss_attack', { id: b.id, attack: atk });
  switch (atk) {
    case 'burst':
      b.state = 'burst'; b.burstsLeft = 3; b.t = 0.3;
      break;
    case 'spiral':
      b.state = 'spiral'; b.t = 2.4; b.spiralTimer = 0; b.spiralAngle = world.rng.range(0, Math.PI * 2);
      break;
    case 'jam':
      b.state = 'jam_windup'; b.t = 0.9; b.aim = Math.atan2(target.y - b.y, target.x - b.x);
      break;
    case 'toner': {
      b.state = 'toner'; b.t = 0.6;
      const targets = world.alivePlayers();
      const n = b.phase2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const p = targets[i % targets.length];
        const ox = i === 0 ? 0 : world.rng.range(-90, 90), oy = i === 0 ? 0 : world.rng.range(-90, 90);
        createArea(world, 'toner_warning', p.x + ox, p.y + oy, { r: 38, life: 1.0 });
      }
      world.emit('boss_throw', { id: b.id });
      break;
    }
    case 'summon': {
      b.state = 'summon'; b.t = 0.8;
      for (let i = 0; i < 2; i++) {
        const a = world.rng.range(0, Math.PI * 2);
        let x = b.x + Math.cos(a) * 60, y = b.y + Math.sin(a) * 60;
        if (world.map.boxSolid(x - 12, y - 12, x + 12, y + 12)) { x = b.x; y = b.y + 50; }
        createEnemy(world, 'prova_voadora', x, y, b.roomId, { spawnTime: 0.7, minion: true });
      }
      break;
    }
  }
}

