import { moveToward, enemySpeed, enemyShoot, nearestPlayer, predictAim, createEnemy } from './Enemy.js';
import { bossXerox } from './chefes/xerox.js';
import { bossKatia } from './chefes/katia.js';
import { bossSamara } from './chefes/samara.js';
import { explode, hurtPlayer } from '../combat.js';
import { createArea } from '../areas.js';

function wander(world, e, dt) {
  e.wanderT -= dt;
  if (e.wanderT <= 0) {
    e.wanderA = world.rng.range(0, Math.PI * 2);
    e.wanderT = world.rng.range(0.8, 2);
  }
  const s = enemySpeed(e) * 0.5;
  const r = world.map.moveBox(e, Math.cos(e.wanderA) * s * dt, Math.sin(e.wanderA) * s * dt);
  if (r.hitX || r.hitY) e.wanderT = 0;
}

/** Caderno Zumbi: persegue, prepara (com aviso de faixa) e dá um bote que deixa um rastro de tinta. */
function chaser(world, e, dt, target) {
  if (!target) return wander(world, e, dt);
  const L = e.def.lunge;
  const d = Math.hypot(target.x - e.x, target.y - e.y);
  e.cd -= dt;
  if (e.state === 'windup') {
    e.t -= dt;
    e.telegraph = { type: 'line', angle: e.aim, length: L.speed * L.duration, width: e.r * 2 };
    if (e.t <= 0) {
      e.state = 'lunge'; e.t = L.duration; e.contactOverride = 1; e.telegraph = null;
      e.trailX = e.x; e.trailY = e.y;
      createArea(world, 'ink_trail', e.x, e.y, { r: 16, life: 3 });
    }
    return;
  }
  if (e.state === 'lunge') {
    e.t -= dt;
    const r = world.map.moveBox(e, Math.cos(e.aim) * L.speed * dt, Math.sin(e.aim) * L.speed * dt);
    // uma poça de tinta a cada ~30 px percorridos
    while (Math.hypot(e.x - e.trailX, e.y - e.trailY) >= 30) {
      const k = 30 / Math.hypot(e.x - e.trailX, e.y - e.trailY);
      e.trailX += (e.x - e.trailX) * k; e.trailY += (e.y - e.trailY) * k;
      createArea(world, 'ink_trail', e.trailX, e.trailY, { r: 16, life: 3 });
    }
    if (e.t <= 0 || r.hitX || r.hitY) { e.state = 'move'; e.cd = L.cooldown * e.atkMul; e.contactOverride = undefined; }
    return;
  }
  const wob = Math.sin(world.time * 3 + e.id) * 0.5;
  const a = Math.atan2(target.y - e.y, target.x - e.x) + wob;
  const s = enemySpeed(e);
  world.map.moveBox(e, Math.cos(a) * s * dt, Math.sin(a) * s * dt);
  e.facing = target.x > e.x ? 1 : -1;
  if (L && d < L.range && e.cd <= 0) {
    e.state = 'windup';
    e.t = L.windup;
    e.aim = Math.atan2(target.y - e.y, target.x - e.x);
  }
}

/** Mantém distância e anda de lado (usado por quem atira à distância). */
function keepDistance(world, e, dt, target, speedMul = 1) {
  const [minR, maxR] = e.def.preferredRange || [140, 240];
  const d = Math.hypot(target.x - e.x, target.y - e.y);
  const s = enemySpeed(e) * speedMul;
  if (d < minR) moveToward(world, e, target.x, target.y, s, dt, -1);
  else if (d > maxR) moveToward(world, e, target.x, target.y, s, dt, 1);
  else {
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeDir *= -1; e.strafeT = world.rng.range(1, 2.5); }
    const a = Math.atan2(target.y - e.y, target.x - e.x) + (Math.PI / 2) * e.strafeDir;
    const r = world.map.moveBox(e, Math.cos(a) * s * 0.7 * dt, Math.sin(a) * s * 0.7 * dt);
    if (r.hitX || r.hitY) e.strafeDir *= -1;
  }
}

/** Prova Voadora: mantém distância e atira rajadas de `attack.burst` tiros com mira prevista. */
function shooter(world, e, dt, target) {
  if (!target) return wander(world, e, dt);
  const atk = e.def.attack;
  e.facing = target.x > e.x ? 1 : -1;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) { e.state = 'burst'; e.burstLeft = atk.burst ?? 3; e.t = 0; }
    return;
  }
  if (e.state === 'burst') {
    e.t -= dt;
    if (e.t <= 0) {
      enemyShoot(world, e, predictAim(e, target, atk.speed), atk);
      e.burstLeft--;
      e.t = 0.12;
      if (e.burstLeft <= 0) { e.state = 'move'; e.cd = atk.interval * e.atkMul * world.rng.range(0.85, 1.15); }
    }
    return;
  }
  keepDistance(world, e, dt, target);
  e.cd -= dt;
  if (e.cd <= 0 && world.map.lineOfSight(e.x, e.y, target.x, target.y)) {
    e.state = 'windup';
    e.t = atk.windup;
  }
}

/**
 * Estojo Raivoso: fechado (invulnerável, anda devagar). A cada `attack.interval` abre, avisa, solta o leque
 * e fica aberto por `openTime` — só nessa janela leva dano.
 */
function fanShooter(world, e, dt, target) {
  const atk = e.def.attack;
  if (e.state === 'move') { e.state = 'closed'; e.shielded = 1; }
  if (target) e.facing = target.x > e.x ? 1 : -1;
  if (e.state === 'open') {
    e.t -= dt;
    if (!e.fanFired) {
      if (target) e.aim = Math.atan2(target.y - e.y, target.x - e.x);
      e.telegraph = { type: 'line', angle: e.aim, length: 150, width: 2 * 150 * Math.tan((atk.spread / 2) * Math.PI / 180) };
      e.warn -= dt;
      if (e.warn <= 0) { enemyShoot(world, e, e.aim, atk); e.fanFired = true; e.telegraph = null; }
    }
    if (e.t <= 0) { e.state = 'closed'; e.shielded = 1; e.fanFired = false; e.telegraph = null; e.cd = atk.interval * e.atkMul * world.rng.range(0.85, 1.15); }
    return;
  }
  if (!target) return wander(world, e, dt);
  keepDistance(world, e, dt, target, 0.7);
  e.cd -= dt;
  if (e.cd <= 0) { // sem exigir linha de visão: fechado ele é imune, então não pode travar a sala
    e.state = 'open';
    e.shielded = 0;
    e.fanFired = false;
    e.warn = atk.windup;
    e.t = atk.windup + (e.def.openTime ?? 1.2);
  }
}

/** Lousa: espiral giratória. Brilha (windup), depois `arms` braços giram `turnRate` rad/s por `duration` s. */
function turret(world, e, dt, target) {
  const atk = e.def.attack;
  if (target) e.facing = target.x > e.x ? 1 : -1;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) {
      e.state = 'spin'; e.t = atk.duration; e.shotT = 0;
      e.spinA = target ? Math.atan2(target.y - e.y, target.x - e.x) : 0;
    }
    return;
  }
  if (e.state === 'spin') {
    e.t -= dt;
    e.spinA += atk.turnRate * dt;
    e.shotT -= dt;
    if (e.shotT <= 0) {
      e.shotT = 0.15;
      const arms = atk.arms + (e.elite ? 1 : 0);
      for (let i = 0; i < arms; i++) enemyShoot(world, e, e.spinA + (i / arms) * Math.PI * 2, { ...atk, bullets: 1, spread: 0, noExtra: true });
    }
    if (e.t <= 0) { e.state = 'move'; e.cd = atk.interval * e.atkMul; }
    return;
  }
  e.cd -= dt;
  if (e.cd <= 0 && target) { e.state = 'windup'; e.t = atk.windup; }
}

/** Sinal do Recreio: flutua e "toca", soltando anéis de ondas sonoras com uma abertura. */
function ringer(world, e, dt, target) {
  const atk = e.def.attack;
  if (!target) return wander(world, e, dt);
  e.facing = target.x > e.x ? 1 : -1;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t <= 0) {
      const n = atk.bullets;
      const gapAt = Math.atan2(target.y - e.y, target.x - e.x) + world.rng.range(-1, 1);
      for (let i = 0; i < n; i++) {
        const a = gapAt + 0.5 + (i / n) * (Math.PI * 2 - 1);
        enemyShoot(world, e, a, { ...atk, speed: atk.ringSpeeds ? atk.ringSpeeds[(e.rings || 0) % atk.ringSpeeds.length] : atk.speed, bullets: 1, spread: 0, noExtra: true });
      }
      e.rings = (e.rings || 0) + 1;
      if (e.rings < (e.elite ? 3 : 2)) { e.t = 0.35; } else { e.rings = 0; e.state = 'move'; e.cd = atk.interval * e.atkMul; }
      world.emit('bell', { x: e.x, y: e.y });
    }
    return;
  }
  e.wanderT -= dt;
  if (e.wanderT <= 0) { e.wanderA = Math.atan2(target.y - e.y, target.x - e.x) + world.rng.range(-1.5, 1.5); e.wanderT = world.rng.range(0.6, 1.4); }
  const s = enemySpeed(e);
  const r = world.map.moveBox(e, Math.cos(e.wanderA) * s * dt, Math.sin(e.wanderA) * s * dt);
  if (r.hitX || r.hitY) e.wanderT = 0;
  e.cd -= dt;
  if (e.cd <= 0) { e.state = 'windup'; e.t = atk.windup; }
}

/** Mochila-bomba: corre em zigue-zague até o jogador, acende o pavio (aviso circular) e explode deixando fogo. */
function kamikaze(world, e, dt, target) {
  const K = e.def.explosion || { radius: 60, damage: 6, fireTime: 3 };
  if (e.state === 'fuse') {
    e.t -= dt;
    e.telegraph = { type: 'circle', x: e.x, y: e.y, r: K.radius };
    if (e.t <= 0) {
      e.exploded = true;
      e.dead = true;
      e.minion = true;
      e.telegraph = null;
      explode(world, e.x, e.y, K.radius, K.damage, { hurtsPlayers: true, style: 'barrel', playerDamage: 2 });
      createArea(world, 'fire_ground', e.x, e.y, { r: K.radius * 0.7, life: K.fireTime, damage: 1 });
    }
    return;
  }
  if (!target) return wander(world, e, dt);
  const d = Math.hypot(target.x - e.x, target.y - e.y);
  // zigue-zague: soma um seno na direção perpendicular à da perseguição
  const a = Math.atan2(target.y - e.y, target.x - e.x);
  const side = Math.sin(world.time * 7 + e.id) * 0.9;
  const s = enemySpeed(e);
  const vx = Math.cos(a) + -Math.sin(a) * side, vy = Math.sin(a) + Math.cos(a) * side;
  const m = Math.hypot(vx, vy) || 1;
  world.map.moveBox(e, (vx / m) * s * dt, (vy / m) * s * dt);
  e.facing = target.x > e.x ? 1 : -1;
  if (d < 46) { e.state = 'fuse'; e.t = 0.65; world.emit('fuse', { x: e.x, y: e.y }); }
}

/** Anda em direção ao alvo com um leve balanço (usado por quem só persegue). */
function approach(world, e, dt, target, speedMul = 1) {
  const a = Math.atan2(target.y - e.y, target.x - e.x) + Math.sin(world.time * 3 + e.id) * 0.4;
  const s = enemySpeed(e) * speedMul;
  const r = world.map.moveBox(e, Math.cos(a) * s * dt, Math.sin(a) * s * dt);
  e.facing = target.x > e.x ? 1 : -1;
  return r;
}

/** Borracha Divisora: persegue; ao morrer se divide (veja splitterDeath). */
function splitter(world, e, dt, target) {
  if (!target) return wander(world, e, dt);
  approach(world, e, dt, target);
}

function splitterDeath(world, e) {
  const S = e.def.split;
  const gen = e.gen || 0;
  if (!S || gen >= S.maxGen) return;
  for (let i = 0; i < S.count; i++) {
    const a = world.rng.range(0, Math.PI * 2);
    const f = createEnemy(world, e.type, e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, e.roomId, { spawnTime: 0.3, gen: gen + 1 });
    f.r = e.r * S.size;
    f.maxHp = f.hp = Math.max(1, Math.round(e.maxHp / 2));
    f.kx = Math.cos(a) * 140; f.ky = Math.sin(a) * 140; // pulam para os lados
  }
}

/** Distância até a parede na direção `angle` (andando de 8 em 8 px). */
function wallDistance(world, e, angle, max) {
  let d = 0;
  while (d < max && !world.map.solidAt(e.x + Math.cos(angle) * d, e.y + Math.sin(angle) * d)) d += 8;
  return d;
}

/** Grampeador Touro: aviso de faixa, investe em linha reta; ao bater na parede fica tonto (dano dobrado). */
function charger(world, e, dt, target) {
  const C = e.def.charge;
  if (e.state === 'windup') {
    e.t -= dt;
    if (target && e.t > C.lockTime) e.aim = Math.atan2(target.y - e.y, target.x - e.x);
    e.telegraph = { type: 'line', angle: e.aim, length: Math.min(C.maxDistance, wallDistance(world, e, e.aim, C.maxDistance)), width: e.r * 2 };
    e.facing = Math.cos(e.aim) >= 0 ? 1 : -1;
    if (e.t <= 0) { e.state = 'charge'; e.traveled = 0; e.telegraph = null; e.contactOverride = C.damage; }
    return;
  }
  if (e.state === 'charge') {
    const step = C.speed * dt;
    const r = world.map.moveBox(e, Math.cos(e.aim) * step, Math.sin(e.aim) * step);
    e.traveled += step;
    const wall = r.hitX || r.hitY;
    if (wall || e.traveled >= C.maxDistance) {
      e.contactOverride = undefined;
      e.cd = C.cooldown * e.atkMul;
      if (wall) { e.state = 'stunned'; e.t = C.stun; world.emit('charger_crash', { x: e.x, y: e.y }); } else e.state = 'move';
    }
    return;
  }
  if (e.state === 'stunned') {
    e.t -= dt;
    if (e.t <= 0) e.state = 'move';
    return;
  }
  if (!target) return wander(world, e, dt);
  approach(world, e, dt, target);
  e.cd -= dt;
  if (e.cd <= 0 && Math.hypot(target.x - e.x, target.y - e.y) < C.range && world.map.lineOfSight(e.x, e.y, target.x, target.y)) {
    e.state = 'windup';
    e.t = C.windup;
    e.aim = Math.atan2(target.y - e.y, target.x - e.x);
  }
}

/** Régua Mira-Laser: fica longe; aviso fino que segue o alvo e trava no fim; tiro rápido. */
function sniper(world, e, dt, target) {
  if (!target) return wander(world, e, dt);
  const atk = e.def.attack;
  e.facing = target.x > e.x ? 1 : -1;
  if (e.state === 'windup') {
    e.t -= dt;
    if (e.t > atk.lockTime) e.aim = Math.atan2(target.y - e.y, target.x - e.x);
    e.telegraph = { type: 'line', angle: e.aim, length: atk.range, width: 2 };
    if (e.t <= 0) {
      e.telegraph = null;
      enemyShoot(world, e, e.aim, { ...atk, noExtra: true });
      e.state = 'move';
      e.cd = atk.interval * e.atkMul * world.rng.range(0.9, 1.1);
    }
    return;
  }
  keepDistance(world, e, dt, target);
  e.cd -= dt;
  if (e.cd <= 0 && world.map.lineOfSight(e.x, e.y, target.x, target.y)) {
    e.state = 'windup';
    e.t = atk.aimTime;
    e.aim = Math.atan2(target.y - e.y, target.x - e.x);
  }
}

/** Apontador Escavador: enterra, segue o alvo por baixo, avisa com um círculo, emerge e fica exposto. */
function burrower(world, e, dt, target) {
  const B = e.def.burrow;
  if (e.state === 'dig') {
    e.t -= dt;
    if (!target) return;
    moveToward(world, e, target.x, target.y, enemySpeed(e) * B.speedMul, dt);
    if (e.t <= 0 || Math.hypot(target.x - e.x, target.y - e.y) < 20) {
      e.state = 'warn'; e.t = B.warn;
      e.warnX = target.x; e.warnY = target.y;
    }
    return;
  }
  if (e.state === 'warn') {
    e.t -= dt;
    e.telegraph = { type: 'circle', x: e.warnX, y: e.warnY, r: B.radius };
    if (e.t <= 0) {
      e.telegraph = null;
      if (!world.map.solidAt(e.warnX, e.warnY)) { e.x = e.warnX; e.y = e.warnY; }
      e.burrowed = false;
      e.state = 'exposed'; e.t = B.exposed;
      for (const p of world.players) {
        if (p.dead || p.downed || p.jailTimer > 0) continue;
        if (Math.hypot(p.x - e.x, p.y - e.y) < B.radius + p.r * 0.5) hurtPlayer(world, p, B.damage);
      }
      world.emit('explosion', { x: e.x, y: e.y, radius: B.radius, style: 'barrel' });
    }
    return;
  }
  if (e.state === 'exposed') {
    e.t -= dt;
    if (e.t <= 0) { e.state = 'move'; e.cd = 0.8; }
    return;
  }
  if (!target) return wander(world, e, dt);
  approach(world, e, dt, target);
  e.cd -= dt;
  if (e.cd <= 0) { e.state = 'dig'; e.burrowed = true; e.t = world.rng.range(B.travel[0], B.travel[1]); }
}

/** Monitor de Turma: fica longe e, a cada `interval`, brilha e chama cadernos zumbis (máx. vivos). */
function summoner(world, e, dt, target) {
  const S = e.def.summon;
  if (e.state === 'windup') {
    e.t -= dt;
    e.telegraph = { type: 'circle', x: e.x, y: e.y, r: e.r + 16 };
    if (e.t <= 0) {
      e.telegraph = null;
      const vivos = world.enemies.filter((m) => m.summonerId === e.id && !m.dead).length;
      const n = Math.min(world.rng.int(S.count[0], S.count[1]), S.max - vivos);
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n)) * Math.PI * 2 + world.rng.range(0, 1);
        const x = e.x + Math.cos(a) * 28, y = e.y + Math.sin(a) * 28;
        createEnemy(world, S.type, world.map.solidAt(x, y) ? e.x : x, world.map.solidAt(x, y) ? e.y : y, e.roomId, { minion: true, summonerId: e.id });
      }
      e.state = 'move';
      e.cd = S.interval * e.atkMul;
    }
    return;
  }
  if (!target) return wander(world, e, dt);
  e.facing = target.x > e.x ? 1 : -1;
  keepDistance(world, e, dt, target);
  e.cd -= dt;
  if (e.cd <= 0) { e.state = 'windup'; e.t = S.warn; }
}

/** Monitor morto: os cadernos que ele chamou somem junto (a sala não fica com sobras). */
function summonerDeath(world, e) {
  for (const m of world.enemies) {
    if (m.summonerId !== e.id || m.dead) continue;
    m.dead = true;
    world.emit('enemy_vanish', { x: m.x, y: m.y, id: m.id, enemyType: m.type });
  }
}

/** Grêmio Estudantil: foge do jogador e, a cada `interval`, cura (20%) um aliado ferido ou dá escudo de 1 golpe. */
function buffer(world, e, dt, target) {
  const B = e.def.buff;
  if (e.linkT > 0) { e.linkT -= dt; if (e.linkT <= 0) e.healTarget = 0; }
  if (target) {
    e.facing = target.x > e.x ? 1 : -1;
    const r = moveToward(world, e, target.x, target.y, enemySpeed(e), dt, -1);
    if (r.hitX || r.hitY) { // encurralado: escorrega pela parede
      const a = Math.atan2(target.y - e.y, target.x - e.x) + (Math.PI / 2) * e.strafeDir;
      const r2 = world.map.moveBox(e, Math.cos(a) * enemySpeed(e) * dt, Math.sin(a) * enemySpeed(e) * dt);
      if (r2.hitX || r2.hitY) e.strafeDir *= -1;
    }
  } else wander(world, e, dt);
  e.cd -= dt;
  if (e.cd > 0) return;
  let hurt = null, bare = null, hd = Infinity, bd = Infinity;
  for (const o of world.enemies) {
    if (o === e || o.dead || o.spawning > 0 || o.def.boss || o.def.invulnerable) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y);
    if (d > B.range) continue;
    if (o.hp < o.maxHp * 0.9 && d < hd) { hd = d; hurt = o; }
    if (!o.shielded && d < bd) { bd = d; bare = o; }
  }
  const alvo = hurt || bare;
  if (!alvo) return; // ninguém por perto: tenta de novo no próximo passo
  if (hurt) alvo.hp = Math.min(alvo.maxHp, alvo.hp + Math.ceil(alvo.maxHp * B.heal));
  else { alvo.shielded = 1; alvo.shieldHit = true; }
  e.healTarget = alvo.id;
  e.linkT = B.linkTime;
  e.cd = B.interval * e.atkMul;
  world.emit('gremio_buff', { x: alvo.x, y: alvo.y, heal: !!hurt });
}

/** Chamada Fantasma: some; avisa um ponto perto do alvo, aparece, solta o leque e some de novo. */
function blinker(world, e, dt, target) {
  const B = e.def.blink;
  if (e.state === 'move') { e.state = 'hidden'; e.burrowed = true; e.t = e.cd; e.cd = 0; }
  if (e.state === 'hidden') {
    if (!target) return;
    e.t -= dt;
    if (e.t > 0) return;
    for (let i = 0; i < 10; i++) {
      const a = world.rng.range(0, Math.PI * 2), d = world.rng.range(B.minR, B.maxR);
      const x = target.x + Math.cos(a) * d, y = target.y + Math.sin(a) * d;
      if (world.map.boxSolid(x - e.r, y - e.r, x + e.r, y + e.r)) continue;
      e.warnX = x; e.warnY = y; e.state = 'warn'; e.t = B.warn;
      return;
    }
    return; // sem ponto livre: tenta de novo no próximo passo
  }
  if (e.state === 'warn') {
    e.t -= dt;
    e.telegraph = { type: 'circle', x: e.warnX, y: e.warnY, r: e.r + 14 };
    if (e.t <= 0) {
      e.telegraph = null;
      e.x = e.warnX; e.y = e.warnY;
      e.burrowed = false;
      e.state = 'appear'; e.t = B.visible; e.fanFired = false;
      world.emit('teleport', { id: e.id, x: e.x, y: e.y });
    }
    return;
  }
  if (e.state === 'appear') {
    e.t -= dt;
    if (target) e.facing = target.x > e.x ? 1 : -1;
    if (!e.fanFired && e.t <= B.visible - B.fireDelay) {
      e.fanFired = true;
      if (target) enemyShoot(world, e, predictAim(e, target, e.def.attack.speed), e.def.attack);
    }
    if (e.t <= 0) { e.state = 'hidden'; e.burrowed = true; e.t = B.interval * e.atkMul; world.emit('enemy_vanish', { x: e.x, y: e.y, id: e.id, enemyType: e.type, blink: true }); }
  }
}

/** Aluno da Assembleia (Katia): anda devagar para o centro da roda, empurrando quem estiver na frente. */
function assembly(world, e, dt) {
  const s = enemySpeed(e);
  const d = Math.hypot(e.cx - e.x, e.cy - e.y);
  if (d > e.stopR) moveToward(world, e, e.cx, e.cy, s, dt);
}

/** Divã (Katia, fase 2): parado; cura a Katia enquanto existir. */
function healer(world, e, dt) {
  const boss = world.enemies.find((b) => b.def.boss && !b.dead && b.roomId === e.roomId);
  if (!boss) return;
  boss.hp = Math.min(boss.maxHp, boss.hp + e.def.healPerSecond * dt * (world.players.length > 1 ? 1.5 : 1));
  e.healTarget = boss.id;
}

/** Caderno Preto (Samara): persegue um jogador; quem é pego fica "assinando" e não pode atacar. */
function capturer(world, e, dt) {
  let target = world.players.find((p) => p.id === e.targetId && !p.downed && !p.dead && !(p.signing > 0) && !(p.jailTimer > 0));
  if (!target) target = nearestPlayer(world, e);
  if (!target) return;
  e.targetId = target.id;
  const a = Math.atan2(target.y - e.y, target.x - e.x);
  const s = enemySpeed(e);
  e.x += Math.cos(a) * s * dt; // atravessa obstáculos (é um caderno gigante voando)
  e.y += Math.sin(a) * s * dt;
  e.facing = Math.cos(a) > 0 ? 1 : -1;
  if (Math.hypot(target.x - e.x, target.y - e.y) < target.r + e.r) {
    const solo = world.players.filter((p) => !p.dead).length === 1;
    target.signing = solo ? 3 : 5;
    target.signFree = 0;
    hurtPlayer(world, target, 1);
    world.emit('signing', { id: target.id, x: target.x, y: target.y });
    e.dead = true;
    e.minion = true;
    world.emit('enemy_vanish', { x: e.x, y: e.y, id: e.id, enemyType: e.type });
  }
}

export const BEHAVIORS = {
  chaser,
  shooter,
  fan_shooter: fanShooter,
  turret,
  ringer,
  kamikaze,
  assembly,
  healer,
  capturer,
  splitter,
  charger,
  sniper,
  burrower,
  summoner,
  buffer,
  blinker,
  boss_xerox: bossXerox,
  boss_katia: bossKatia,
  boss_samara: bossSamara
};

/** Ganchos de comportamento chamados por killEnemy (ao morrer). */
export const BEHAVIOR_HOOKS = {
  splitter: { onDeath: splitterDeath },
  summoner: { onDeath: summonerDeath }
};
