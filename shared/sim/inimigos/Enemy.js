
import { damageEnemy, hurtPlayer, hurtAlly } from '../combat.js';
import { spawnProjectile } from '../armas/Projectiles.js';
import { BEHAVIORS } from './behaviors.js';
import { AFFIXES, rollAffix } from './affixes.js';

export function createEnemy(world, type, x, y, roomId, { spawnTime = 0.9, minion = false, elite = false, ...extra } = {}) {
  const def = world.data.enemy(type);
  const players = Math.max(1, world.players.filter((p) => !p.dead).length);
  const scaleByPlayers = def.boss || def.scaleWithPlayers ? 1 + 0.6 * (players - 1) : 1;
  const scale = (def.boss ? 1 : (world.floorDef.hpScale || 1)) * scaleByPlayers * (elite ? 2 : 1);
  const e = {
    id: world.newId(), kind: 'enemy', type, def,
    x, y, r: def.radius * (elite ? 1.2 : 1),
    hp: Math.round(def.hp * scale), maxHp: Math.round(def.hp * scale),
    roomId, minion, elite,
    atkMul: elite ? 0.75 : 1, extraBullets: elite ? 1 : 0,
    speedMul: elite ? 1.1 : 1,
    life: def.life || 0,
    spawning: spawnTime,
    state: 'move', t: 0,
    cd: world.rng.range(0.6, 1.6),     // primeiro ataque com atraso aleatório
    aim: 0, facing: 1,
    kx: 0, ky: 0, flash: 0,
    status: {}, contactCd: 0,
    strafeDir: world.rng.chance(0.5) ? 1 : -1, strafeT: world.rng.range(1, 2.5),
    wanderA: world.rng.range(0, Math.PI * 2), wanderT: 0,
    dead: false,
    ...extra
  };
  if (def.behavior === 'fan_shooter') { e.state = 'closed'; e.shielded = 1; }
  // elite (nunca chefe) ganha um modificador sorteado
  if (elite && !def.boss && !e.affix) e.affix = rollAffix(world, def);
  AFFIXES[e.affix]?.onCreate?.(world, e);
  world.enemies.push(e);
  world.emit('enemy_spawn', { id: e.id, x, y, enemyType: type, boss: !!def.boss });
  return e;
}

export function nearestPlayer(world, e) {
  let best = null, bd = Infinity;
  for (const p of world.players) {
    if (p.dead || p.downed || p.jailTimer > 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Alvo mais próximo do inimigo: jogador vivo ou aliado com provocação (taunt) e hp > 0. */
export function nearestTarget(world, e) {
  let best = nearestPlayer(world, e);
  let bd = best ? Math.hypot(best.x - e.x, best.y - e.y) : Infinity;
  for (const a of world.allies) {
    if (a.dead || !a.taunt || !(a.hp > 0)) continue;
    const d = Math.hypot(a.x - e.x, a.y - e.y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

/** Ângulo para acertar onde o alvo estará (velocidade do alvo × tempo de voo × lead). Sem vx/vy = mira direta. */
export function predictAim(e, target, bulletSpeed, lead = 1) {
  const dx = target.x - e.x, dy = target.y - e.y;
  if (target.vx === undefined || !bulletSpeed) return Math.atan2(dy, dx);
  const t = (Math.hypot(dx, dy) / bulletSpeed) * lead;
  return Math.atan2(dy + (target.vy || 0) * t, dx + (target.vx || 0) * t);
}

export function enemySpeed(e) {
  let s = e.def.speed * (e.speedMul || 1);
  if (e.status.slow > 0) s *= e.status.slowMul ?? 0.5;
  return s;
}

export function moveToward(world, e, tx, ty, speed, dt, sign = 1) {
  const a = Math.atan2(ty - e.y, tx - e.x);
  const res = world.map.moveBox(e, Math.cos(a) * speed * dt * sign, Math.sin(a) * speed * dt * sign);
  if (Math.cos(a) * sign !== 0) e.facing = Math.cos(a) * sign > 0 ? 1 : -1;
  return res;
}

export function enemyShoot(world, e, angle, atk) {
  const n = (atk.bullets || 1) + (atk.noExtra ? 0 : e.extraBullets || 0);
  for (let i = 0; i < n; i++) {
    const a = n > 1 ? angle + ((-atk.spread / 2 + (atk.spread * i) / (n - 1)) * Math.PI) / 180 : angle;
    spawnProjectile(world, {
      team: 'enemy', x: e.x, y: e.y - 4, angle: a,
      speed: atk.speed, radius: atk.radius || 5, damage: atk.damage || 1,
      range: atk.range || 900, sprite: 'ebullet_' + (atk.style || 'paper'), style: atk.style || 'paper',
      slow: atk.slow || 0, shooter: e.id, explode: atk.explode || null, explodeOnExpire: !!atk.explode
    });
  }
  world.emit('enemy_shoot', { x: e.x, y: e.y, style: atk.style, boss: !!e.def.boss });
}

function tickStatus(world, e, dt) {
  const s = e.status;
  for (const k of ['burn', 'poison']) {
    const st = s[k];
    if (!st) continue;
    st.t -= dt;
    st.tick += dt;
    if (st.tick >= 0.5) {
      st.tick = 0;
      damageEnemy(world, e, Math.max(1, st.dps * 0.5), { source: st.src, noMul: true });
    }
    if (st.t <= 0) s[k] = null;
  }
  if (s.slow > 0) s.slow -= dt;
  if (s.frozen > 0) s.frozen -= dt;
}

export function updateEnemies(world, dt) {
  for (const e of world.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.spawning > 0) { e.spawning -= dt; continue; }
    tickStatus(world, e, dt);
    if (e.dead) continue;
    if (e.kx || e.ky) {
      world.map.moveBox(e, e.kx * dt, e.ky * dt);
      const f = Math.pow(0.001, dt);
      e.kx *= f; e.ky *= f;
      if (Math.abs(e.kx) + Math.abs(e.ky) < 5) e.kx = e.ky = 0;
    }
    e.contactCd = Math.max(0, e.contactCd - dt);
    if (e.status.stun > 0) { e.status.stun -= dt; continue; }
    const target = nearestTarget(world, e);
    const fn = BEHAVIORS[e.def.behavior];
    if (fn) fn(world, e, dt, target);
    if (e.dead) continue;
    if (e.affix) AFFIXES[e.affix]?.onUpdate?.(world, e, dt);
    if (e.life > 0) {
      e.life -= dt;
      if (e.life <= 0) { e.minion = true; e.dead = true; world.emit('enemy_vanish', { x: e.x, y: e.y, id: e.id, enemyType: e.type }); continue; }
    }
    // dano de contato
    const cdmg = e.contactOverride ?? e.def.contactDamage;
    if (cdmg && e.contactCd <= 0 && !e.burrowed) {
      for (const p of world.players) {
        if (p.dead || p.downed || p.jailTimer > 0) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r - 2) {
          if (hurtPlayer(world, p, cdmg)) {
            e.contactCd = 0.8;
            if (e.affix) AFFIXES[e.affix]?.onHit?.(world, e, p);
          }
        }
      }
    }
    if (cdmg && e.contactCd <= 0 && !e.burrowed) {
      for (const a of world.allies) {
        if (a.dead || !(a.hp > 0)) continue;
        if (Math.hypot(a.x - e.x, a.y - e.y) < a.r + e.r - 2) {
          hurtAlly(world, a, cdmg);
          e.contactCd = 0.8;
          break;
        }
      }
    }
    // alunos da "Assembleia" empurram os jogadores
    if (e.def.pushPlayers) {
      for (const p of world.players) {
        if (p.dead || p.downed || p.jailTimer > 0) continue;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        const min = p.r + e.r;
        if (d < min && d > 0.01) {
          const push = min - d;
          world.map.moveBox(p, ((p.x - e.x) / d) * push, ((p.y - e.y) / d) * push);
        }
      }
    }
  }
  separate(world);
}

/** Empurra inimigos sobrepostos para não ficarem empilhados. */
function separate(world) {
  const list = world.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.spawning > 0) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || b.spawning > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = a.r + b.r;
      if (d >= min) continue;
      const push = (min - d) / 2;
      const nx = dx / d, ny = dy / d;
      const aBoss = !!a.def.boss, bBoss = !!b.def.boss;
      if (!aBoss) world.map.moveBox(a, -nx * push * (bBoss ? 2 : 1), -ny * push * (bBoss ? 2 : 1));
      if (!bBoss) world.map.moveBox(b, nx * push * (aBoss ? 2 : 1), ny * push * (aBoss ? 2 : 1));
    }
  }
}

