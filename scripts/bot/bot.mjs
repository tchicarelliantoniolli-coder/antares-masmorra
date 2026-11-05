// Bot que joga partidas inteiras usando só a API pública do World (igual na v0.2 e na v0.3),
// para calibrar a dificuldade. Não importa nada de shared/: quem chama passa World e data.
const TILE = 32;
const NAV_EVERY = 0.25;

export const PROFILES = {
  // reaction: s até reagir a bala vindo; aimError: graus; dodge: chance por bala; keepRange: px
  dupla: { reaction: 0.5, aimError: 14, dodge: 0.6, keepRange: 180, useSkill: false },
  experiente: { reaction: 0.25, aimError: 7, dodge: 0.85, keepRange: 220, useSkill: true }
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEIGH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Campo de distâncias (BFS) a partir de (tx, ty) sobre tiles não sólidos. */
function distField(map, tx, ty) {
  const dist = new Int32Array(map.w * map.h).fill(-1);
  if (map.isSolidTile(tx, ty)) return dist;
  const q = new Int32Array(map.w * map.h);
  let h = 0, t = 0;
  q[t++] = ty * map.w + tx;
  dist[q[0]] = 0;
  while (h < t) {
    const i = q[h++], x = i % map.w, y = (i / map.w) | 0, d = dist[i] + 1;
    for (const [dx, dy] of NEIGH) {
      const nx = x + dx, ny = y + dy;
      if (map.isSolidTile(nx, ny)) continue;
      const j = ny * map.w + nx;
      if (dist[j] >= 0) continue;
      dist[j] = d;
      q[t++] = j;
    }
  }
  return dist;
}

// Arma corpo a corpo exige chegar perto; o bot só recolhe armas de longe e, se já estiver com uma, chega junto.
const isMelee = (world, id) => world.data.weapon(id)?.type === 'melee';

export function createBot(world, playerId, profile, rng = Math.random) {
  const st = {
    fields: new Map(), fieldSig: null, fieldAt: -1,
    goal: null, goalAt: -1, blocked: new Map(),
    strafe: rng() < 0.5 ? 1 : -1, strafeUntil: 0,
    dodging: new Map(), seen: new Map(), dmg: 0, dmgAt: 0, interactCd: 0, swapAt: -9, skillCd: 0
  };
  const me = () => world.getPlayer(playerId);
  const gauss = () => (rng() + rng() + rng() - 1.5) / 0.75; // ~[-2, 2]

  function field(tx, ty) {
    const sig = `${world.floorNum}:${world.map.locked.size}:${world.activeRoom?.id ?? -1}`;
    if (sig !== st.fieldSig || world.time - st.fieldAt > NAV_EVERY * 4) {
      st.fields.clear(); st.fieldSig = sig; st.fieldAt = world.time;
    }
    const k = ty * world.map.w + tx;
    let f = st.fields.get(k);
    if (!f) { f = distField(world.map, tx, ty); st.fields.set(k, f); }
    return f;
  }

  function freeTileNear(cx, cy) {
    const m = world.map;
    for (let r = 0; r < 8; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (!m.isSolidTile(cx + dx, cy + dy)) return [cx + dx, cy + dy];
      }
    }
    return [cx, cy];
  }

  /** Próximo ponto do caminho até (tx, ty): desce o campo de distâncias, pegando o mais longe com linha reta livre. */
  function steer(p, tx, ty) {
    const f = field(tx, ty), m = world.map;
    let cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
    let d = f[cy * m.w + cx];
    if (d < 0) return null;
    let best = [(cx + 0.5) * TILE, (cy + 0.5) * TILE];
    for (let n = 0; n < 8 && d > 0; n++) {
      let moved = false;
      for (const [dx, dy] of NEIGH) {
        const nd = f[(cy + dy) * m.w + cx + dx];
        if (nd >= 0 && nd < d) { cx += dx; cy += dy; d = nd; moved = true; break; }
      }
      if (!moved) break;
      const px = (cx + 0.5) * TILE, py = (cy + 0.5) * TILE;
      if (n > 0 && !clearLine(p, px, py)) break;
      best = [px, py];
    }
    return best;
  }

  /** Linha reta com folga para o raio do jogador (testa três linhas paralelas). */
  function clearLine(p, x, y) {
    const a = Math.atan2(y - p.y, x - p.x), nx = -Math.sin(a) * (p.r || 10), ny = Math.cos(a) * (p.r || 10);
    const m = world.map;
    return m.lineOfSight(p.x, p.y, x, y) && m.lineOfSight(p.x + nx, p.y + ny, x + nx, y + ny) &&
      m.lineOfSight(p.x - nx, p.y - ny, x - nx, y - ny);
  }

  function liveEnemies() {
    const r = world.activeRoom;
    return r ? world.enemies.filter((e) => !e.dead && e.roomId === r.id) : [];
  }

  /** Escolhe o objetivo: { kind, x, y, pk?, key }. */
  function pickGoal(p, enemies) {
    const ok = (g) => g && !(st.blocked.get(g.key) > world.time);
    const cands = [];
    if (enemies.length) return null; // lutar
    const portal = world.pickups.find((k) => !k.dead && k.kind === 'portal');
    if (portal) cands.push({ kind: 'pk', pk: portal, key: 'portal' });
    // só recolhe arma sem custo de energia (energia acaba nas lutas longas) e de dano por segundo maior que a atual
    const dps = (id) => { const w = world.data.weapon(id); return (w?.damage || 0) * (w?.fireRate || 1); };
    const free = (id) => !(world.data.weapon(id)?.energyCost > 0);
    const held = Math.max(...p.weapons.filter((id) => free(id)).map(dps), 0);
    for (const k of world.pickups) {
      if (k.dead || k.kind !== 'weapon' || !free(k.weaponId) || isMelee(world, k.weaponId) || dps(k.weaponId) <= held * 1.2) continue;
      cands.push({ kind: 'pk', pk: k, key: 'w' + k.id });
    }
    for (const k of world.pickups) if (!k.dead && k.kind === 'chest' && !k.opened) cands.push({ kind: 'pk', pk: k, key: 'c' + k.id });
    if (p.hp < p.maxHp) {
      for (const k of world.pickups) if (!k.dead && k.kind === 'heal_station' && !k.used) cands.push({ kind: 'pk', pk: k, key: 'h' + k.id });
    }
    if (p.energy < p.maxEnergy * 0.7) {
      for (const k of world.pickups) if (!k.dead && k.kind === 'energy') cands.push({ kind: 'en', pk: k, key: 'e' + k.id });
    }
    const tier = [];
    for (const g of cands) if (ok(g)) { g.x = g.pk.x; g.y = g.pk.y; tier.push(g); }
    const lowEnergy = tier.filter((g) => g.kind === 'en');
    if (lowEnergy.length) return closest(p, lowEnergy);
    // portal > arma > baú > enfermaria: devolve o primeiro da prioridade; entre iguais, o mais perto
    for (const test of [(g) => g.key === 'portal', (g) => g.key[0] === 'w', (g) => g.key[0] === 'c', (g) => g.key[0] === 'h']) {
      const list = tier.filter(test);
      if (list.length) return closest(p, list);
    }
    // salas ainda por limpar
    const rooms = world.rooms.filter((r) => r.state === 'idle' && r.type === 'combat');
    const roomGoals = (rs) => rs.map((r) => {
      const [tx, ty] = freeTileNear(r.cx, r.cy);
      return { kind: 'room', key: 'r' + r.id, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
    }).filter(ok);
    let list = roomGoals(rooms);
    if (!list.length) list = roomGoals(world.rooms.filter((r) => r.state === 'idle' && r.type === 'boss'));
    return list.length ? closest(p, list) : null;
  }

  function closest(p, list) {
    let best = null, bd = Infinity;
    for (const g of list) {
      const f = field(Math.floor(g.x / TILE), Math.floor(g.y / TILE));
      const d = f[Math.floor(p.y / TILE) * world.map.w + Math.floor(p.x / TILE)];
      const score = d < 0 ? 1e9 : d;
      if (score < bd) { bd = score; best = g; }
    }
    return best;
  }

  /**
   * Desvio de balas: só reage a bala vista há pelo menos `reaction` s e sorteada com chance `dodge`.
   * Entre parar e as 8 direções, simula 0,7 s à frente e escolhe a que não encosta em nenhuma bala
   * (prefere a direção que o bot já queria seguir). Devolve null se o movimento atual já é seguro.
   */
  function dodgeVector(p, wantX, wantY) {
    const hot = [];
    for (const b of world.projectiles) {
      if (b.dead || b.team !== 'enemy') continue;
      let seen = st.seen.get(b.id);
      if (seen === undefined) { seen = world.time; st.seen.set(b.id, seen); }
      if (world.time - seen < profile.reaction) continue;
      let dec = st.dodging.get(b.id);
      if (dec === undefined) { dec = rng() < profile.dodge; st.dodging.set(b.id, dec); }
      if (dec) hot.push(b);
    }
    if (st.seen.size > 600) st.seen.clear();
    if (st.dodging.size > 600) st.dodging.clear();
    if (!hot.length) return null;
    const speed = p.speed * (p.mods?.speedMul || 1) * (p.buffs?.hasteTimer > 0 ? 1.6 : 1) * (p.slowTimer > 0 ? 0.55 : 1);
    const T = 0.7, N = 14, pr = p.r || 10;
    const cost = (dx, dy) => {
      let x = p.x, y = p.y, c = 0;
      for (let k = 1; k <= N; k++) {
        const t = (k * T) / N;
        const nx = p.x + dx * speed * t, ny = p.y + dy * speed * t;
        if (!world.map.solidAt(nx, ny)) { x = nx; y = ny; }
        for (const b of hot) {
          const hr = (b.r || 5) + pr + 2;
          if (Math.hypot(b.x + b.vx * t - x, b.y + b.vy * t - y) < hr) c += 100 - t * 60;
        }
      }
      return c;
    };
    const wl = Math.hypot(wantX, wantY);
    const wx = wl ? wantX / wl : 0, wy = wl ? wantY / wl : 0;
    if (cost(wx, wy) === 0) return null;
    let best = null, bc = Infinity;
    for (let i = -1; i < 8; i++) {
      const dx = i < 0 ? 0 : Math.cos((i * Math.PI) / 4), dy = i < 0 ? 0 : Math.sin((i * Math.PI) / 4);
      const c = cost(dx, dy) + (1 - (dx * wx + dy * wy)) * 3;
      if (c < bc) { bc = c; best = [dx, dy]; }
    }
    return best;
  }

  function think(dt) {
    const p = me();
    const inp = { moveX: 0, moveY: 0, aim: p?.aim ?? 0, aimDist: 220, fire: false, skill: false, interact: false, swap: false };
    if (!p || p.downed || p.dead || world.state !== 'playing') return inp;
    st.interactCd -= dt; st.skillCd -= dt;
    const enemies = liveEnemies();
    const near = (list) => {
      let best = null, bd = Infinity;
      for (const e of list) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
      return best ? [best, bd] : [null, Infinity];
    };
    const move = (tx, ty) => {
      const w = steer(p, Math.floor(tx / TILE), Math.floor(ty / TILE));
      if (!w) return false;
      const d = Math.hypot(w[0] - p.x, w[1] - p.y) || 1;
      inp.moveX = (w[0] - p.x) / d; inp.moveY = (w[1] - p.y) / d;
      return true;
    };

    // Co-op: colega caído e sem inimigo perto -> fica parado do lado dele, sem atirar
    const [, nearestEnemyDist] = near(world.enemies.filter((e) => !e.dead));
    const downed = world.players.find((q) => q !== p && q.downed && !q.dead);
    if (downed && nearestEnemyDist >= 200) {
      const d = Math.hypot(downed.x - p.x, downed.y - p.y);
      if (d > 28) move(downed.x, downed.y);
      return inp;
    }

    if (enemies.length) {
      const sighted = enemies.filter((e) => world.map.lineOfSight(p.x, p.y, e.x, e.y));
      const healers = sighted.filter((e) => e.type === 'diva'); // cura a chefe: acaba com ela primeiro // cura a chefe: acaba com ela primeiro
      const [tgt, td] = near(healers.length ? healers : sighted.length ? sighted : enemies);
      const dx = tgt.x - p.x, dy = tgt.y - p.y, a = Math.atan2(dy, dx);
      const seen = sighted.length > 0;
      if (seen) {
        inp.aim = a + (gauss() * profile.aimError * Math.PI) / 180 * 0.5;
        inp.aimDist = td;
        inp.fire = true;
        if (p.wstate?.chargeFull) inp.fire = false; // solta a carga
        // mantém distância e anda de lado
        if (world.time > st.strafeUntil) { st.strafe = rng() < 0.5 ? 1 : -1; st.strafeUntil = world.time + 1 + rng() * 1.5; }
        const keep = isMelee(world, p.weapons[p.cur ?? 0]) ? 45 : profile.keepRange;
        const rad = td < keep * 0.8 ? -1 : td > keep * 1.2 ? 1 : 0;
        let mx = (dx / td) * rad + (-dy / td) * st.strafe * 0.7, my = (dy / td) * rad + (dx / td) * st.strafe * 0.7;
        // se a direção está bloqueada por parede, vira o lado
        const ahead = Math.atan2(my, mx);
        if (world.map.solidAt(p.x + Math.cos(ahead) * 28, p.y + Math.sin(ahead) * 28)) { st.strafe *= -1; st.strafeUntil = world.time + 1; mx = -mx; my = -my; }
        inp.moveX = mx; inp.moveY = my;
        // sem energia: vai buscar a bolinha de energia mais próxima (inimigos largam ao morrer)
        if (p.energy < p.maxEnergy * 0.15) {
          let eb = null, ed = 300;
          for (const k of world.pickups) {
            if (k.dead || k.kind !== 'energy') continue;
            const d = Math.hypot(k.x - p.x, k.y - p.y);
            if (d < ed) { ed = d; eb = k; }
          }
          if (eb) move(eb.x, eb.y);
        }
        // Troca de arma automática: 4 s lutando sem causar dano indica arma inútil contra este alvo
        // (ex.: armadilha de chão contra inimigo voador), então o bot passa para a outra arma.
        if (world.stats.damage > st.dmg) { st.dmg = world.stats.damage; st.dmgAt = world.time; }
        else if (world.time - st.dmgAt > 4 && p.weapons.length > 1) { inp.swap = true; st.dmgAt = world.time; }
        // escolhe a arma de maior dano por segundo que a energia atual aguenta (armas de custo 0 nunca acabam)
        if (p.weapons.length > 1 && world.time - st.swapAt > 1) {
          let bi = p.cur, bs = -1;
          p.weapons.forEach((id, i) => {
            const w = world.data.weapon(id), cost = (w?.energyCost || 0) * (p.mods?.energyCostMul || 1);
            if (cost > 0 && p.energy < cost * (i === p.cur ? 1 : 20)) return;
            const sc = (w?.damage || 0) * (w?.fireRate || 1) * (cost > 0 ? 1 : 0.999);
            if (sc > bs) { bs = sc; bi = i; }
          });
          if (bi !== p.cur) { inp.swap = true; st.swapAt = world.time; }
        }
        if (profile.useSkill && st.skillCd <= 0 && td < 320) { inp.skill = true; st.skillCd = 0.6; }
      } else {
        move(tgt.x, tgt.y);
      }
    } else {
      st.dmgAt = world.time;
      // objetivo (recalculado a cada 0,25 s)
      if (world.time - st.goalAt >= NAV_EVERY || !st.goal) {
        st.goal = pickGoal(p, enemies); st.goalAt = world.time;
      }
      const g = st.goal;
      if (g) {
        const reach = g.kind === 'pk' ? (g.key[0] === 'w' ? 5 : 28) : 0; // arma: fica em cima (há várias caídas juntas)
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d > reach) {
          if (!move(g.x, g.y)) { st.blocked.set(g.key, world.time + 3); st.goal = null; }
        }
        if (g.kind === 'pk' && p.interactTarget === g.pk && st.interactCd <= 0) { inp.interact = true; st.interactCd = 0.4; }
        // não conseguiu pegar depois de chegar: ignora por um tempo
        if (g.kind === 'pk' && d < 30 && g.pk.dead) st.goal = null;
        // perto há mais de 3 s e não pegou (interação sempre vai para outro item): desiste por um tempo
        if (g.kind === 'pk' && d < 30) {
          if (st.nearSince === undefined || st.nearKey !== g.key) { st.nearSince = world.time; st.nearKey = g.key; }
          else if (world.time - st.nearSince > 3) { st.blocked.set(g.key, world.time + 30); st.goal = null; st.nearSince = undefined; }
        } else st.nearSince = undefined;
      }
    }

    // desvio de balas sobrepõe o movimento
    const dv = dodgeVector(p, inp.moveX, inp.moveY);
    if (dv) { inp.moveX = dv[0]; inp.moveY = dv[1]; }
    return inp;
  }

  return { think };
}

/** Roda uma partida sem tela, a 60 passos por segundo. */
export function runMatch({ World, data, seed, players = 1, profile, maxSeconds = 1500, characterIds, worldOpts = {} }) {
  const ids = characterIds || ['harilson', 'marina', 'vinicius', 'rosana'];
  const list = [];
  for (let i = 0; i < players; i++) list.push({ id: `p${i + 1}`, characterId: ids[i % ids.length], name: `Bot ${i + 1}` });
  const world = new World({ data, seed, players: list, ...worldOpts });
  const rng = mulberry32(seed * 7919 + 13);
  const bots = list.map((pl) => createBot(world, pl.id, profile, rng));
  const dt = 1 / 60;
  let sig = '', sigAt = 0, lastDmg = 0;
  while (world.state === 'playing') {
    if (world.time >= maxSeconds) return { victory: false, floor: world.floorNum, seconds: world.time, reason: 'timeout' };
    const inputs = {};
    list.forEach((pl, i) => { inputs[pl.id] = bots[i].think(dt); });
    try { world.step(dt, inputs); } catch (err) {
      return { victory: false, floor: world.floorNum, seconds: world.time, reason: 'error', error: err.message, stack: String(err.stack).split('\n').slice(0, 3).join('\n') };
    }
    world.drainEvents();
    // travado: 20 s sem mudar de sala nem causar dano
    const s = world.floorNum + ':' + world.players.map((q) => q.roomId).join(',') + ':' + world.rooms.filter((r) => r.state === 'cleared').length;
    if (s !== sig || world.stats.damage > lastDmg) { sig = s; sigAt = world.time; }
    lastDmg = world.stats.damage;
    if (world.time - sigAt > 20) return { victory: false, floor: world.floorNum, seconds: world.time, reason: 'stuck' };
  }
  const victory = world.state === 'victory';
  return { victory, floor: world.floorNum, seconds: world.time, reason: victory ? 'victory' : 'defeat' };
}
