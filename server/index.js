// Servidor do jogo: arquivos do cliente + multiplayer online (Socket.io, servidor autoritativo).
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { loadGameDataNode } from '../shared/sim/loadDataNode.js';
import { RoomManager } from './RoomManager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();

app.use(express.static(path.join(root, 'client')));
app.use('/shared', express.static(path.join(root, 'shared')));
app.use('/vendor', express.static(path.join(root, 'node_modules/phaser/dist')));
app.use('/fonts', express.static(path.join(root, 'node_modules/@fontsource/press-start-2p/files')));
app.use('/fonts', express.static(path.join(root, 'node_modules/@fontsource/vt323/files')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: manager.rooms.size }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const data = loadGameDataNode();
const manager = new RoomManager(data);

io.on('connection', (socket) => {
  const conn = { send: (ev, payload) => socket.emit(ev, payload) };
  let room = null;
  let playerId = null;
  const leave = () => {
    if (room && playerId) room.remove(playerId);
    room = null;
    playerId = null;
  };
  const reply = (ack, value) => { if (typeof ack === 'function') ack(value); };

  socket.on('room:create', ({ name } = {}, ack) => {
    leave();
    const r = manager.create(conn, name);
    if (r.ok) { room = r.room; playerId = r.playerId; }
    reply(ack, { ok: r.ok, error: r.error, code: r.code, playerId: r.playerId });
  });

  socket.on('room:join', ({ code, name } = {}, ack) => {
    leave();
    const r = manager.join(code, conn, name);
    if (r.ok) { room = r.room; playerId = r.playerId; }
    reply(ack, { ok: r.ok, error: r.error, code: r.code, playerId: r.playerId });
  });

  socket.on('room:leave', () => leave());
  socket.on('lobby:character', (characterId, ack) => reply(ack, room ? room.setCharacter(playerId, characterId) : { ok: false }));
  socket.on('lobby:ready', (ready, ack) => reply(ack, room ? room.setReady(playerId, ready) : { ok: false }));
  socket.on('input', (msg) => { if (room && msg) room.input(playerId, msg.i, msg.s); });
  socket.on('disconnect', () => leave());
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`\n  Antares: A Masmorra Escolar`);
  console.log(`  Abra no navegador: http://localhost:${PORT}\n`);
});
