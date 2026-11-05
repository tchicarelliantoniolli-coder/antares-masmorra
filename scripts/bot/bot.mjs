// Bot que joga partidas inteiras usando só a API pública do World (igual na v0.2 e na v0.3),
// para calibrar a dificuldade. Não importa nada de shared/: quem chama passa World e data.
const TILE = 32;
const RARITY = { comum: 0, incomum: 1, rara: 2, epica: 3, lendaria: 4 };
const NAV_EVERY = 0.25;

export const PROFILES = {
  // reaction: s até reagir a bala vindo; aimError: graus; dodge: chance por bala; keepRange: px
  dupla: { reaction: 0.35, aimError: 9, dodge: 0.35, keepRange: 180, useSkill: false },
  experiente: { reaction: 0.15, aimError: 3, dodge: 0.75, keepRange: 220, useSkill: true }
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

const rarityOf = (world, id) => RARITY[world.data.weapon(id)?.rarity] ?? 0;

export function createBot(world, playerId, profile, rng = Math.random) {
  const st = {
    fields: new Map(), fieldSig: null, fieldAt: -1,
    goal: null, goalAt: -1, blocked: new Map(),
    strafe: rng() < 0.5 ? 1 : -1, strafeUntil: 0,
    dodging: new Map(), dmg: 0, dmgAt: 0, interactCd: 0, skillCd: 0
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
    const held = Math.max(...p.weapons.map((id) => rarityOf(world, id)));
    for (const k of world.pickups) {
      if (k.dead || k.kind !== 'weapon' || rarityOf(world, k.weaponId) <= held) continue;
      cands.push({ kind: 'pk', pk: k, key: 'w' + k.id });
    }
    for (const k of world.pickups) if (!k.dead && k.kind === 'chest' && !k.opened) cands.push({ kind: 'pk', pk: k, key: 'c' + k.id });
    if (p.hp < p.maxHp) {
      for (const k of world.pickups) if (!k.dead && k.kind === 'heal_station' && !k.used) cands.push({ kind: 'pk', pk: k, key: 'h' + k.id });
    }
    const tier = [];
    for (const g of cands) if (ok(g)) { g.x = g.pk.x; g.y = g.pk.y; tier.push(g); }
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

  function dodgeVector(p) {
    let vx = 0, vy = 0;
    const reach = profile.reaction * 260;
    for (const b of world.projectiles) {
      if (b.dead || b.team !== 'enemy') continue;
      const rx = p.x - b.x, ry = p.y - b.y, dist = Math.hypot(rx, ry);
      const sp = Math.hypot(b.vx, b.vy) || 1;
      if (dist > Math.max(40, reach * sp / 260 + 30)) continue;
      const along = (b.vx * rx + b.vy * ry) / sp; // distância ao longo da trajetória
      if (along <= 0) continue;
      const side = (b.vx * ry - b.vy * rx) / sp; // desvio lateral da trajetória
      if (Math.abs(side) > (b.r || 5) + (p.r || 10) + 10) continue;
      let dec = st.dodging.get(b.id);
      if (dec === undefined) { dec = rng() < profile.dodge; st.dodging.set(b.id, dec); }
      if (!dec) continue;
      const s = side >= 0 ? 1 : -1; // foge para o lado em que já está
      vx += (b.vy / sp) * s; vy -= (b.vx / sp) * s;
    }
    if (st.dodging.size > 400) st.dodging.clear();
    return (vx || vy) ? [vx, vy] : null;
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
      const [tgt, td] = near(sighted.length ? sighted : enemies);
      const dx = tgt.x - p.x, dy = tgt.y - p.y, a = Math.atan2(dy, dx);
      const seen = sighted.length > 0;
      if (seen) {
        inp.aim = a + (gauss() * profile.aimError * Math.PI) / 180 * 0.5;
        inp.aimDist = td;
        inp.fire = true;
        if (p.wstate?.chargeFull) inp.fire = false; // solta a carga
        // mantém distância e anda de lado
        if (world.time > st.strafeUntil) { st.strafe = rng() < 0.5 ? 1 : -1; st.strafeUntil = world.time + 1 + rng() * 1.5; }
        const rad = td < profile.keepRange * 0.8 ? -1 : td > profile.keepRange * 1.2 ? 1 : 0;
        let mx = (dx / td) * rad + (-dy / td) * st.strafe * 0.7, my = (dy / td) * rad + (dx / td) * st.strafe * 0.7;
        // se a direção está bloqueada por parede, vira o lado
        const ahead = Math.atan2(my, mx);
        if (world.map.solidAt(p.x + Math.cos(ahead) * 28, p.y + Math.sin(ahead) * 28)) { st.strafe *= -1; st.strafeUntil = world.time + 1; mx = -mx; my = -my; }
        inp.moveX = mx; inp.moveY = my;
        // Troca de arma automática: 4 s lutando sem causar dano indica arma inútil contra este alvo
        // (ex.: armadilha de chão contra inimigo voador), então o bot passa para a outra arma.
        if (world.stats.damage > st.dmg) { st.dmg = world.stats.damage; st.dmgAt = world.time; }
        else if (world.time - st.dmgAt > 4 && p.weapons.length > 1) { inp.swap = true; st.dmgAt = world.time; }
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
        const reach = g.kind === 'pk' ? 28 : 0;
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d > reach) {
          if (!move(g.x, g.y)) { st.blocked.set(g.key, world.time + 3); st.goal = null; }
        }
        if (g.kind === 'pk' && p.interactTarget === g.pk && st.interactCd <= 0) { inp.interact = true; st.interactCd = 0.4; }
        // não conseguiu pegar depois de chegar: ignora por um tempo
        if (g.kind === 'pk' && d < 30 && g.pk.dead) st.goal = null;
      }
    }

    // desvio de balas sobrepõe o movimento
    const dv = dodgeVector(p);
    if (dv) { const l = Math.hypot(dv[0], dv[1]) || 1; inp.moveX = dv[0] / l; inp.moveY = dv[1] / l; }
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
