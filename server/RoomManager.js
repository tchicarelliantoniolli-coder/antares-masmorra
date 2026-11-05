// Salas do modo online. O servidor é a autoridade: roda a simulação (World) e envia o estado
// para todos os jogadores da sala. Esta classe não conhece o Socket.io: cada jogador tem um
// objeto "conn" com send(evento, dados), o que deixa tudo testável sem rede.
import { World } from '../shared/sim/World.js';
import { TICK } from '../shared/sim/constants.js';
import { InputBuffer } from '../shared/net/InputBuffer.js';
import { serializeMap, serializeWorld } from '../shared/net/snapshot.js';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_PLAYERS = 4;
const SNAP_EVERY = 3; // 60 Hz de simulação, 20 Hz de envio

export class RoomManager {
  constructor(data, { autoTick = true } = {}) {
    this.data = data;
    this.rooms = new Map();
    this.autoTick = autoTick;
  }

  newCode() {
    for (let i = 0; i < 1000; i++) {
      let c = '';
      for (let k = 0; k < 4; k++) c += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
      if (!this.rooms.has(c)) return c;
    }
    throw new Error('Sem códigos livres');
  }

  create(conn, name) {
    if (this.rooms.size > 500) return { ok: false, error: 'Servidor cheio, tente mais tarde.' };
    const room = new Room(this, this.newCode());
    this.rooms.set(room.code, room);
    const player = room.add(conn, name);
    return { ok: true, code: room.code, playerId: player.id, room };
  }

  join(code, conn, name) {
    const room = this.rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return { ok: false, error: 'Sala não encontrada. Confira o código.' };
    if (room.state !== 'lobby') return { ok: false, error: 'A partida dessa sala já começou.' };
    if (room.players.length >= MAX_PLAYERS) return { ok: false, error: 'Sala cheia (máximo 4 jogadores).' };
    const player = room.add(conn, name);
    return { ok: true, code: room.code, playerId: player.id, room };
  }

  destroy(room) {
    room.stopLoop();
    this.rooms.delete(room.code);
  }
}

let nextPlayerNum = 1;

export class Room {
  constructor(manager, code) {
    this.manager = manager;
    this.data = manager.data;
    this.code = code;
    this.players = [];
    this.state = 'lobby';
    this.world = null;
    this.inputs = new InputBuffer();
    this.timer = null;
    this.tickCount = 0;
    this.pendingEvents = [];
  }

  add(conn, name) {
    const clean = String(name || '').replace(/[<>]/g, '').trim().slice(0, 14) || `Jogador ${this.players.length + 1}`;
    const p = { id: 'n' + nextPlayerNum++, conn, name: clean, characterId: null, ready: false, host: this.players.length === 0 };
    // já escolhe o primeiro professor livre
    p.characterId = this.firstFreeCharacter();
    this.players.push(p);
    this.broadcastState();
    return p;
  }

  firstFreeCharacter() {
    const taken = new Set(this.players.map((p) => p.characterId));
    const c = this.data.characterList.find((ch) => ch.playable && !taken.has(ch.id));
    return c ? c.id : null;
  }

  get(id) { return this.players.find((p) => p.id === id); }

  publicState() {
    return {
      code: this.code,
      state: this.state,
      players: this.players.map((p) => ({ id: p.id, name: p.name, characterId: p.characterId, ready: p.ready, host: p.host }))
    };
  }

  broadcast(event, payload) {
    for (const p of this.players) p.conn.send(event, payload);
  }

  broadcastState() { this.broadcast('room:state', this.publicState()); }

  /** Cada professor só pode ser escolhido por um jogador. */
  setCharacter(id, characterId) {
    const p = this.get(id);
    if (!p || this.state !== 'lobby') return { ok: false, error: 'Não dá para trocar agora.' };
    const c = this.data.characters.get(characterId);
    if (!c || !c.playable) return { ok: false, error: 'Professor indisponível.' };
    if (this.players.some((q) => q !== p && q.characterId === characterId)) return { ok: false, error: 'Esse professor já foi escolhido.' };
    p.characterId = characterId;
    p.ready = false;
    this.broadcastState();
    return { ok: true };
  }

  setReady(id, ready) {
    const p = this.get(id);
    if (!p || this.state !== 'lobby') return { ok: false };
    if (ready && !p.characterId) return { ok: false, error: 'Escolha um professor primeiro.' };
    p.ready = !!ready;
    this.broadcastState();
    if (this.players.length > 0 && this.players.every((q) => q.ready)) this.start();
    return { ok: true };
  }

  start() {
    this.state = 'playing';
    this.inputs = new InputBuffer();
    this.world = new World({
      data: this.data,
      players: this.players.map((p) => ({ id: p.id, characterId: p.characterId, name: p.name })),
      mode: 'online'
    });
    this.world.drainEvents();
    const mapMsg = serializeMap(this.world);
    for (const p of this.players) p.conn.send('game:start', { youId: p.id, players: this.publicState().players, ...mapMsg });
    this.broadcast('game:snap', { ...serializeWorld(this.world), ev: [] });
    this.broadcastState();
    this.endSent = false;
    if (this.manager.autoTick) this.startLoop();
  }

  startLoop() {
    this.stopLoop();
    this.last = Date.now();
    this.acc = 0;
    this.timer = setInterval(() => {
      const now = Date.now();
      this.acc += Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      let n = 0;
      while (this.acc >= TICK && n < 8) { this.tick(); this.acc -= TICK; n++; }
    }, 1000 / 60);
  }

  stopLoop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  input(id, inp, seq) {
    if (this.state !== 'playing') return;
    if (!this.get(id)) return;
    this.inputs.set(id, inp, seq);
  }

  /** Um passo de simulação (60 por segundo). */
  tick() {
    const w = this.world;
    if (!w) return;
    w.step(TICK, this.inputs.inputs);
    this.inputs.consumed();
    const ev = w.drainEvents();
    if (ev.some((e) => e.type === 'floor_start')) {
      this.broadcast('game:map', serializeMap(w));
    }
    this.pendingEvents.push(...ev);
    this.tickCount++;
    if (this.tickCount % SNAP_EVERY === 0) {
      this.broadcast('game:snap', { ...serializeWorld(w, this.inputs.seq), ev: this.pendingEvents });
      this.pendingEvents = [];
    }
    if (w.state !== 'playing' && w.endTimer > 2.5 && !this.endSent) this.finish();
  }

  finish() {
    this.endSent = true;
    const w = this.world;
    this.broadcast('game:end', {
      victory: w.state === 'victory',
      stats: w.stats,
      floor: w.floorNum,
      players: w.players.map((p) => ({ id: p.id, name: p.name, charId: p.charId, kills: p.kills, damage: p.damageDealt, coins: p.coins, weapons: p.weapons }))
    });
    this.stopLoop();
    this.state = 'lobby';
    this.world = null;
    for (const p of this.players) p.ready = false;
    this.broadcastState();
  }

  remove(id) {
    const i = this.players.findIndex((p) => p.id === id);
    if (i < 0) return;
    const [p] = this.players.splice(i, 1);
    if (p.host && this.players[0]) this.players[0].host = true;
    this.inputs.remove(id);
    if (this.world) {
      const wp = this.world.getPlayer(id);
      if (wp) { wp.dead = true; wp.downed = true; this.world.emit('player_left', { id, name: p.name }); }
    }
    if (!this.players.length) { this.manager.destroy(this); return; }
    this.broadcastState();
    // se todos os que sobraram já estavam prontos, começa
    if (this.state === 'lobby' && this.players.every((q) => q.ready)) this.start();
  }
}
