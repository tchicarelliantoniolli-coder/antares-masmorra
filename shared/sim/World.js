import { RNG } from './rng.js';
import { TILE } from './constants.js';
import { generateFloor } from './salas/DungeonGenerator.js';
import { updateRooms, setupRoomContents } from './salas/RoomDirector.js';
import { updatePickups } from './salas/Pickups.js';
import { createPlayer, updatePlayers } from './personagens/Player.js';
import { updateEnemies } from './inimigos/Enemy.js';
import { updateProjectiles } from './armas/Projectiles.js';
import { updateAreas } from './areas.js';
import { updateAllies } from './personagens/Allies.js';
import { updateTraps } from './salas/Props.js';

const HISTORY_STEP = 0.1;
const HISTORY_KEEP = 3.2;

/**
 * O "mundo" da partida: toda a lógica do jogo, sem nenhuma dependência do Phaser.
 * - No modo solo/co-op local, roda no navegador.
 * - No modo online (Etapa 2), roda no servidor Node, que é a autoridade.
 * O renderizador só lê o estado e consome os eventos (sons, efeitos, números de dano).
 */
export class World {
  constructor({ data, seed = (Math.random() * 2 ** 31) | 0, players = [], floor = 1, maxFloors = 3, mode = 'solo', roomCount = null }) {
    this.data = data;
    this.seed = seed;
    this.rng = new RNG(seed);
    this.mode = mode;
    this.maxFloors = maxFloors;
    this.time = 0;
    this.nextId = 1;
    this.players = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.areas = [];
    this.allies = [];
    this.history = [];        // registro do time a cada 0,1 s (Linha do Tempo)
    this.nextHistory = 0;
    this.beams = [];          // raios contínuos ativos neste passo (recriados a cada passo)
    this.events = [];
    this.state = 'playing'; // playing | victory | defeat
    this.endTimer = 0;
    this.stats = { kills: 0, damage: 0, coins: 0, roomsCleared: 0, time: 0, shots: 0 };
    this.roomCountOverride = roomCount;
    this.setupFloor(floor);
    for (const p of players) this.addPlayer(p);
  }

  newId() { return this.nextId++; }

  emit(type, payload = {}) { this.events.push({ ...payload, type }); }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  setupFloor(n) {
    this.floorNum = n;
    this.floorDef = this.data.floor(n);
    const { map, rooms, startRoomId, bossRoomId } = generateFloor({ rng: this.rng, floorDef: this.floorDef, roomCount: this.roomCountOverride });
    this.map = map;
    this.rooms = rooms;
    this.startRoomId = startRoomId;
    this.bossRoomId = bossRoomId;
    this.activeRoom = null;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.areas = [];
    this.allies = [];
    this.beams = [];
    this.history = [];
    this.nextHistory = 0;
    this.boss = null;
    setupRoomContents(this);
    const start = rooms[startRoomId];
    start.visited = true;
    start.discovered = true;
    start.state = 'cleared';
    for (const id of start.links) rooms[id].discovered = true;
    // reposiciona jogadores já existentes (troca de andar)
    this.players.forEach((p, i) => this.placeAtStart(p, i));
    this.emit('floor_start', { floor: n, name: this.floorDef.name });
  }

  placeAtStart(p, i) {
    const start = this.rooms[this.startRoomId];
    const offsets = [[-1, 0], [1, 0], [0, 1], [0, -1]];
    const [ox, oy] = offsets[i % 4];
    p.x = (start.cx + 0.5 + ox * 1.5) * TILE;
    p.y = (start.cy + 0.5 + oy * 1.5) * TILE;
  }

  addPlayer({ id, characterId, name, slot = this.players.length }) {
    const p = createPlayer(this, { id, characterId, name, slot });
    this.players.push(p);
    this.placeAtStart(p, this.players.length - 1);
    return p;
  }

  getPlayer(id) { return this.players.find((p) => p.id === id); }

  alivePlayers() { return this.players.filter((p) => !p.downed && !p.dead); }

  roomAt(tx, ty) {
    for (const r of this.rooms) {
      if (tx >= r.x0 && ty >= r.y0 && tx < r.x0 + r.w && ty < r.y0 + r.h) return r;
    }
    return null;
  }

  /** Avança a simulação. inputs = { [playerId]: { moveX, moveY, aim, fire, skill, interact, swap } } */
  step(dt, inputs = {}) {
    if (this.state !== 'playing') {
      this.endTimer += dt;
      return;
    }
    this.time += dt;
    this.stats.time = this.time;
    this.beams = [];
    updatePlayers(this, dt, inputs);
    updateRooms(this, dt);
    updateEnemies(this, dt);
    updateProjectiles(this, dt);
    updateAreas(this, dt);
    updateAllies(this, dt);
    updateTraps(this);
    updatePickups(this, dt);
    this.recordHistory();

    // limpeza
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.pickups.some((p) => p.dead)) this.pickups = this.pickups.filter((p) => !p.dead);
    if (this.areas.some((a) => a.dead)) this.areas = this.areas.filter((a) => !a.dead);
    if (this.allies.some((a) => a.dead)) this.allies = this.allies.filter((a) => !a.dead);

    // derrota: todos caídos (quem saiu da partida online conta como "dead")
    if (this.players.length && this.players.every((p) => p.downed || p.dead)) {
      this.state = 'defeat';
      this.emit('defeat');
    }
  }

  /** Guarda a foto do time a cada 0,1 s, mantendo 3,2 s (usada pela Linha do Tempo). */
  recordHistory() {
    if (this.time < this.nextHistory) return;
    this.nextHistory = this.time + HISTORY_STEP;
    this.history.push({
      t: this.time,
      players: this.players.filter((p) => !p.dead).map((p) => ({ id: p.id, x: p.x, y: p.y, hp: p.hp, shield: p.shield, downed: p.downed }))
    });
    while (this.history.length && this.history[0].t < this.time - HISTORY_KEEP) this.history.shift();
  }

  /** Chamado quando os jogadores entram no portal depois do chefe. */
  completeFloor() {
    if (this.floorNum >= this.maxFloors) {
      this.state = 'victory';
      this.emit('victory');
      return;
    }
    for (const p of this.players) {
      if (p.dead) continue;
      if (p.downed) { p.downed = false; p.hp = Math.ceil(p.maxHp / 2); }
      p.jailTimer = 0; p.jailFrom = null; p.signing = 0; p.pull = null;
      p.reviveProgress = 0;
      p.invuln = 1.5;
    }
    this.stats.floorsCleared = this.floorNum;
    this.setupFloor(this.floorNum + 1);
  }
}
