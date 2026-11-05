import { T } from '/shared/sim/constants.js';
import { buildMirrorMap, decodeSnapshot } from '/shared/net/snapshot.js';

const INTERP = 0.1;     // segundos de atraso para suavizar os outros jogadores/inimigos
const SEND_EVERY = 1 / 30;

/**
 * Sessão online: o servidor roda a partida. Aqui montamos um "espelho" do mundo com o mesmo formato
 * do World local (o renderizador e o HUD não sabem a diferença), interpolando entre os estados
 * recebidos e prevendo o movimento do próprio jogador para não sentir atraso.
 */
export class OnlineSession {
  constructor(data, client, startMsg) {
    this.data = data;
    this.client = client;
    this.myId = startMsg.youId;
    this.localPlayerIds = [this.myId];
    this.world = {
      ...buildMirrorMap(data, startMsg),
      players: [], enemies: [], projectiles: [], pickups: [], areas: [], allies: [],
      boss: null, state: 'playing', endTimer: 0, stats: {}, time: 0,
      getPlayer(id) { return this.players.find((p) => p.id === id); },
      alivePlayers() { return this.players.filter((p) => !p.downed && !p.dead); }
    };
    this.snaps = [];
    this.events = [];
    this.renderT = null;
    this.seq = 0;
    this.sendT = 0;
    this.history = [];
    this.pred = null;
    this.input = { moveX: 0, moveY: 0, aim: 0, fire: false };
    this.edges = { skill: false, interact: false, swap: false };
    this.endData = null;
    this.off = [
      client.on('game:map', (m) => this.onMap(m)),
      client.on('game:snap', (s) => this.onSnap(s)),
      client.on('game:end', (e) => { this.endData = e; }),
      client.on('disconnect', () => { this.disconnected = true; })
    ];
  }

  destroy() { this.off.forEach((f) => f()); }

  onMap(m) {
    Object.assign(this.world, buildMirrorMap(this.data, m));
    this.snaps = [];
    this.pred = null;
    this.history = [];
    this.renderT = null;
  }

  onSnap(s) {
    const dec = decodeSnapshot(this.data, s);
    for (const list of [dec.players, dec.enemies, dec.projectiles, dec.allies, dec.pickups]) for (const o of list) { o._x = o.x; o._y = o.y; }
    this.snaps.push(dec);
    if (this.snaps.length > 12) this.snaps.shift();
    this.newSnap = dec;
    const map = this.world.map;
    for (const ev of s.ev || []) {
      if (ev.type === 'prop_break') { map.props.delete(ev.idx); map.tiles[ev.idx] = T.FLOOR; }
      if (ev.type === 'floor_start') continue; // o mapa novo já chegou em 'game:map'
      this.events.push(ev);
    }
    if ((s.ev || []).some((e) => e.type === 'floor_start')) this.events.push({ type: 'floor_start', floor: s.fl, name: this.data.floor(s.fl).name });
    if (!this.world.players.length) this.update(0); // já monta os jogadores para a câmera e o HUD
  }

  setInput(id, inp) {
    if (id !== this.myId) return;
    const changed = inp.fire !== this.input.fire || Math.sign(inp.moveX) !== Math.sign(this.input.moveX) || Math.sign(inp.moveY) !== Math.sign(this.input.moveY);
    this.input = { moveX: inp.moveX, moveY: inp.moveY, aim: inp.aim, fire: inp.fire };
    let edge = false;
    for (const k of ['skill', 'interact', 'swap']) if (inp[k]) { this.edges[k] = true; edge = true; }
    if (edge || changed) this.sendT = SEND_EVERY; // envia já
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  update(deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const w = this.world;
    // 1) envia o input (30x por segundo, ou na hora quando aperta algo)
    this.sendT += dt;
    if (this.sendT >= SEND_EVERY) {
      this.sendT = 0;
      this.seq++;
      const msg = { ...this.input, ...this.edges };
      const hasEdge = this.edges.skill || this.edges.interact || this.edges.swap;
      if (hasEdge) this.client.sendInputReliable(msg, this.seq);
      else this.client.sendInput(msg, this.seq);
      this.edges = { skill: false, interact: false, swap: false };
    }
    if (!this.snaps.length) return;
    const latest = this.snaps[this.snaps.length - 1];

    // 2) estado "lento" vem do snapshot mais novo
    w.state = latest.st;
    w.endTimer = latest.et;
    w.stats = latest.stats;
    w.map.locked = new Set(latest.locked);
    latest.rooms.forEach((bits, i) => {
      const r = w.rooms[i];
      if (!r) return;
      r.state = (bits & 3) === 0 ? 'idle' : (bits & 3) === 1 ? 'active' : 'cleared';
      r.visited = !!(bits & 4); r.discovered = !!(bits & 8); r.bossDefeated = !!(bits & 16);
    });

    // 3) interpolação entre dois snapshots
    if (this.renderT === null) this.renderT = latest.t - INTERP;
    this.renderT += dt;
    const target = latest.t - INTERP;
    if (this.renderT > latest.t) this.renderT = latest.t;
    if (Math.abs(target - this.renderT) > 0.3) this.renderT = target;
    else this.renderT += (target - this.renderT) * 0.05;
    let a = this.snaps[0], b = latest;
    for (let i = 0; i < this.snaps.length - 1; i++) {
      if (this.snaps[i].t <= this.renderT && this.snaps[i + 1].t >= this.renderT) { a = this.snaps[i]; b = this.snaps[i + 1]; break; }
    }
    const span = Math.max(0.001, b.t - a.t);
    const alpha = Math.max(0, Math.min(1, (this.renderT - a.t) / span));
    const lerpList = (listA, listB, extrapolate) => {
      const byId = new Map(listA.map((o) => [o.id, o]));
      for (const o of listB) {
        const p = byId.get(o.id);
        if (p && Math.hypot(o._x - p._x, o._y - p._y) < 96) {
          o.x = p._x + (o._x - p._x) * alpha;
          o.y = p._y + (o._y - p._y) * alpha;
        } else if (extrapolate && o.vx !== undefined) {
          o.x = o._x - o.vx * (1 - alpha) * span;
          o.y = o._y - o.vy * (1 - alpha) * span;
        } else { o.x = o._x; o.y = o._y; }
      }
      return listB;
    };
    w.enemies = lerpList(a.enemies, b.enemies);
    w.projectiles = lerpList(a.projectiles, b.projectiles, true);
    w.allies = lerpList(a.allies, b.allies);
    w.pickups = lerpList(a.pickups, b.pickups);
    w.areas = latest.areas;
    w.time = this.renderT;
    const players = lerpList(a.players, b.players);
    // o jogador local usa os dados mais novos (HUD responde na hora) e a posição prevista
    w.players = players.map((p) => (p.id === this.myId ? latest.players.find((q) => q.id === p.id) || p : p));
    w.boss = w.enemies.find((e) => e.id === latest.boss) || null;
    for (const p of w.players) {
      p.interactTarget = p.interactId ? w.pickups.find((k) => k.id === p.interactId) || null : null;
      p.pull = p.pulling ? {} : null;
    }

    // 4) previsão do movimento do jogador local
    const me = latest.players.find((p) => p.id === this.myId);
    if (!me) return;
    if (!this.pred || me.downed || me.dead || me.jailTimer > 0 || me.pulling) {
      this.pred = { x: me._x, y: me._y, r: me.r };
      this.history = [];
    } else {
      let speed = me.speed * (me.mods.speedMul || 1);
      if (me.buffs.hasteTimer > 0) speed *= 1.6;
      if (me.slowTimer > 0) speed *= 0.55;
      if (me.signing > 0) speed *= 0.5;
      let mx = this.input.moveX || 0, my = this.input.moveY || 0;
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      const bx = this.pred.x, by = this.pred.y;
      w.map.moveBox(this.pred, mx * speed * dt, my * speed * dt);
      this.history.push({ seq: this.seq, dx: this.pred.x - bx, dy: this.pred.y - by });
      if (this.history.length > 120) this.history.shift();
      if (this.newSnap) {
        // reconciliação: posição do servidor + movimentos ainda não confirmados
        const ack = me.ack || 0;
        this.history = this.history.filter((h) => h.seq > ack);
        let rx = me._x, ry = me._y;
        for (const h of this.history) { rx += h.dx; ry += h.dy; }
        const ex = rx - this.pred.x, ey = ry - this.pred.y;
        if (Math.hypot(ex, ey) > 80) { this.pred.x = rx; this.pred.y = ry; }
        else { this.pred.x += ex * 0.35; this.pred.y += ey * 0.35; }
      }
    }
    this.newSnap = null;
    me.x = this.pred.x;
    me.y = this.pred.y;
    me.aim = this.input.aim;
    me.moving = Math.hypot(this.input.moveX || 0, this.input.moveY || 0) > 0.1 && !(me.jailTimer > 0);
  }
}
