/**
 * Protocolo do modo online: o servidor serializa o "World" e o cliente monta um espelho dele
 * com o mesmo formato que o renderizador e o HUD já usam.
 */
import { TileMap } from '../sim/salas/TileMap.js';

const r1 = (v) => Math.round(v * 10) / 10;
const STATUS = { burn: 1, poison: 2, slow: 4, frozen: 8, stun: 16 };

export function serializeMap(world) {
  return {
    floor: world.floorNum,
    maxFloors: world.maxFloors,
    map: world.map.serialize(),
    rooms: world.rooms.map((r) => ({
      id: r.id, gx: r.gx, gy: r.gy, type: r.type, theme: r.theme, w: r.w, h: r.h, x0: r.x0, y0: r.y0,
      cx: r.cx, cy: r.cy, links: r.links, doors: r.doors, layout: r.layout, shape: r.shape
    })),
    startRoomId: world.startRoomId,
    bossRoomId: world.bossRoomId
  };
}

function serializePlayer(p, ack) {
  return {
    id: p.id, slot: p.slot, name: p.name, charId: p.charId,
    x: r1(p.x), y: r1(p.y), r: p.r, aim: r1(p.aim * 100) / 100, moving: p.moving,
    hp: p.hp, maxHp: p.maxHp, shield: p.shield, maxShield: p.maxShield,
    energy: Math.floor(p.energy), maxEnergy: p.maxEnergy,
    speed: p.speed, weapons: p.weapons, cur: p.cur,
    skillId: p.skillId, skillCd: r1(p.skillCd), skillCooldown: p.skillCooldown,
    mods: { skillCdMul: p.mods.skillCdMul, energyCostMul: p.mods.energyCostMul, speedMul: p.mods.speedMul, revealMap: !!p.mods.revealMap },
    invuln: r1(p.invuln), downed: p.downed, dead: p.dead, reviveProgress: r1(p.reviveProgress),
    coins: p.coins, kills: p.kills, damageDealt: p.damageDealt, roomId: p.roomId,
    buffs: { nextHitMul: p.buffs.nextHitMul, hasteTimer: r1(p.buffs.hasteTimer), bubbleTimer: r1(p.buffs.bubbleTimer), quakeNext: p.buffs.quakeNext, chainReaction: r1(p.buffs.chainReaction) },
    slowTimer: r1(p.slowTimer), jailTimer: r1(p.jailTimer), signing: r1(p.signing), signFree: r1(p.signFree),
    pulling: !!p.pull, interactId: p.interactTarget ? p.interactTarget.id : 0, blessings: p.blessings,
    ws: p.wstate ? [r1(p.wstate.charge), r1(p.wstate.spin), p.wstate.shielding ? 1 : 0, p.wstate.combo] : [0, 0, 0, 0],
    dash: p.dash ? 1 : 0, aimDist: Math.round(p.aimDist || 0),
    ack: ack ?? 0
  };
}

export function serializeWorld(world, acks = {}) {
  return {
    t: Math.round(world.time * 1000) / 1000,
    st: world.state, et: r1(world.endTimer), fl: world.floorNum,
    locked: [...world.map.locked],
    rooms: world.rooms.map((r) => (r.state === 'idle' ? 0 : r.state === 'active' ? 1 : 2) | (r.visited ? 4 : 0) | (r.discovered ? 8 : 0) | (r.bossDefeated ? 16 : 0)),
    boss: world.boss && !world.boss.dead ? world.boss.id : 0,
    stats: world.stats,
    players: world.players.map((p) => serializePlayer(p, acks[p.id])),
    enemies: world.enemies.filter((e) => !e.dead).map((e) => {
      let st = 0;
      for (const k in STATUS) if (e.status[k] && (typeof e.status[k] !== 'number' || e.status[k] > 0)) st |= STATUS[k];
      return [e.id, e.type, r1(e.x), r1(e.y), Math.ceil(e.hp), e.maxHp, r1(e.spawning), e.facing, e.flash > 0 ? 1 : 0,
        e.state, st, e.phase || (e.phase2 ? 2 : 1), e.telegraph || 0, e.elite ? 1 : 0, e.minion ? 1 : 0, e.healTarget || 0, r1(e.r),
        (e.shielded ? 1 : 0) | (e.burrowed ? 2 : 0) | (e.status.confused > 0 ? 4 : 0) | (e.linked ? 8 : 0), e.affix || 0, e.linked ? e.linked.id : 0];
    }),
    proj: world.projectiles.filter((p) => !p.dead).map((p) => [p.id, p.team === 'player' ? 1 : 0, r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.sprite, p.glyph || 0, p.spin || 0,
      r1(p.z || 0), p.lob ? [r1(p.lob.tx), r1(p.lob.ty)] : 0, r1(p.r)]),
    beams: (world.beams || []).map((b) => [b.ownerId, r1(b.x1), r1(b.y1), r1(b.x2), r1(b.y2), b.width, b.color]),
    pickups: world.pickups.filter((k) => !k.dead).map((k) => [k.id, k.kind, r1(k.x), r1(k.y), pickupExtra(k)]),
    areas: world.areas.filter((a) => !a.dead).map((a) => [a.id, a.kind, r1(a.x), r1(a.y), a.r, r1(a.t), a.life, a.targetId || 0, a.style || 0]),
    allies: world.allies.filter((a) => !a.dead).map((a) => [a.id, a.kind, r1(a.x), r1(a.y), r1(a.aim || 0), r1(a.life), a.maxLife, a.ownerId || 0, a.armed ? 1 : 0, a.hp ?? 0, a.maxHp ?? 0])
  };
}

function pickupExtra(k) {
  switch (k.kind) {
    case 'weapon': return { weaponId: k.weaponId };
    case 'chest': return { opened: !!k.opened };
    case 'heal_station': return { used: !!k.used };
    case 'shop_item': return { item: k.item, weaponId: k.weaponId, price: k.price };
    case 'statue': return { blessing: k.blessing, price: k.price, usedBy: k.usedBy };
    case 'npc': return { npc: k.npc };
    default: return 0;
  }
}

// ------------------------------------------------------------------ lado do cliente

/** Monta o mapa + salas do espelho a partir da mensagem 'game:map'. */
export function buildMirrorMap(data, msg) {
  const map = TileMap.deserialize(msg.map);
  const rooms = msg.rooms.map((r) => ({ ...r, state: 'idle', visited: false, discovered: false, bossDefeated: false }));
  return { map, rooms, floorNum: msg.floor, maxFloors: msg.maxFloors, floorDef: data.floor(msg.floor), startRoomId: msg.startRoomId, bossRoomId: msg.bossRoomId };
}

const RADIUS = { energy: 4, coin: 4, health: 6, weapon: 10, chest: 14, heal_station: 14, portal: 20, shop_item: 10, statue: 18, npc: 10 };

/** Converte um snapshot em objetos no formato que o renderizador entende. */
export function decodeSnapshot(data, s) {
  const enemies = s.enemies.map(([id, type, x, y, hp, maxHp, spawning, facing, flash, state, st, phase, telegraph, elite, minion, healTarget, r, flags, affix, linkId]) => ({
    id, type, def: data.enemy(type), x, y, hp, maxHp, spawning, facing, flash: flash ? 0.1 : 0, state,
    status: { burn: !!(st & 1), poison: !!(st & 2), slow: st & 4 ? 1 : 0, frozen: st & 8 ? 1 : 0, stun: st & 16 ? 1 : 0, confused: flags & 4 ? 1 : 0 },
    phase, phase2: phase >= 2, telegraph: telegraph || null, elite: !!elite, minion: !!minion, healTarget, r, dead: false,
    shielded: !!(flags & 1), burrowed: !!(flags & 2), linked: flags & 8 ? { id: linkId } : null, affix: affix || null
  }));
  const projectiles = s.proj.map(([id, team, x, y, vx, vy, sprite, glyph, spin, z, lobTarget, r]) => ({
    id, team: team ? 'player' : 'enemy', x, y, vx, vy, sprite, glyph: glyph || null, spin, age: 0, r: r || 5, z: z || 0, lobTarget: lobTarget || null
  }));
  const beams = (s.beams || []).map(([ownerId, x1, y1, x2, y2, width, color]) => ({ ownerId, x1, y1, x2, y2, width, color }));
  const players = s.players.map((p) => ({
    ...p,
    wstate: { charge: p.ws?.[0] || 0, spin: p.ws?.[1] || 0, shielding: !!p.ws?.[2], combo: p.ws?.[3] || 0 },
    dash: p.dash ? {} : null
  }));
  const pickups = s.pickups.map(([id, kind, x, y, extra]) => ({ id, kind, x, y, r: RADIUS[kind] ?? 6, vx: 0, vy: 0, ...(extra || {}) }));
  const areas = s.areas.map(([id, kind, x, y, r, t, life, targetId, style]) => ({ id, kind, x, y, r, t, life, targetId, style: style || undefined }));
  const allies = s.allies.map(([id, kind, x, y, aim, life, maxLife, ownerId, armed, hp, maxHp]) => ({ id, kind, x, y, aim, life, maxLife, ownerId, armed: !!armed, hp, maxHp }));
  return { ...s, players, enemies, projectiles, pickups, areas, allies, beams };
}
