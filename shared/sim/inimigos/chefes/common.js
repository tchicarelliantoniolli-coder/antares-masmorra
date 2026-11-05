import { TILE, T } from '../../constants.js';

/** Utilidades compartilhadas pelos chefes. */
export function toIdle(b, t) {
  b.state = 'idle';
  b.t = t;
}

export function bossRoom(world, b) {
  return world.rooms[b.roomId];
}

/** Ponto livre (chão) aleatório dentro da sala, longe de um ponto. */
export function freePointInRoom(world, room, awayX, awayY, minDist = 120) {
  for (let i = 0; i < 40; i++) {
    const tx = world.rng.int(room.x0 + 2, room.x0 + room.w - 3);
    const ty = world.rng.int(room.y0 + 2, room.y0 + room.h - 3);
    if (world.map.get(tx, ty) !== T.FLOOR) continue;
    const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
    if (Math.hypot(x - awayX, y - awayY) >= minDist) return [x, y];
  }
  return [(room.cx + 0.5) * TILE, (room.cy + 0.5) * TILE];
}

/** Jogadores que o chefe pode escolher como alvo de um ataque especial. */
export function targetablePlayers(world) {
  return world.players.filter((p) => !p.dead && !p.downed && !(p.jailTimer > 0) && !(p.signing > 0));
}

/** Movimento padrão: mantém uma distância do alvo. */
export function keepDistance(world, b, target, dt, speed, near = 120, far = 220, moveToward) {
  const d = Math.hypot(target.x - b.x, target.y - b.y);
  if (d > far) moveToward(world, b, target.x, target.y, speed, dt);
  else if (d < near) moveToward(world, b, target.x, target.y, speed * 0.7, dt, -1);
}
