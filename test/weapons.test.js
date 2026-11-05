import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, data, dummy, withWeapon, arena, wallDistRight, countEvents } from './helpers.js';
import { energyCost } from '../shared/sim/armas/Weapons.js';
import * as areasMod from '../shared/sim/areas.js';

test('shot sem mode dispara igual a antes', () => {
  const { w, p } = arena();
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.ok(w.projectiles.length > 0);
  assert.equal(p.wstate.weaponId, 'numeros_sinais');
});

test('trocar de arma reseta o estado da arma', () => {
  const { w, p } = arena();
  p.weapons = ['pistola_grampos', 'regua_espada'];
  run(w, 1 / 60);
  p.wstate.charge = 0.7;
  run(w, 1 / 60, { p1: { swap: true } });
  assert.equal(p.wstate.weaponId, 'regua_espada');
  assert.equal(p.wstate.charge, 0);
});

test('pegar arma do chão também reseta o estado', () => {
  const { w, p } = arena();
  run(w, 1 / 60);
  p.wstate.charge = 0.7;
  p.weapons[p.cur] = 'escopeta_clipes';
  run(w, 1 / 60);
  assert.equal(p.wstate.weaponId, 'escopeta_clipes');
  assert.equal(p.wstate.charge, 0);
});

test('assinando (Caderno Preto) não atira', () => {
  const { w, p } = arena();
  p.signing = 2;
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.equal(w.projectiles.length, 0);
});

test('jogador guarda a distância da mira', () => {
  const { w, p } = arena();
  run(w, 1 / 60, { p1: { aim: 0, aimDist: 150 } });
  assert.equal(p.aimDist, 150);
});

// ---------------------------------------------------------------- modos discretos
test('burst: um clique solta 3 tiros e cobra energia uma vez', () => {
  const { w, p } = arena();
  const wp = withWeapon(w, { mode: 'burst', energyCost: 4, fireRate: 0.5, burst: { count: 3, interval: 0.07 } });
  const e0 = p.energy;
  run(w, 0.4, { p1: { fire: true, aim: 0 } });
  assert.equal(countEvents(w, 'shoot'), 3);
  assert.equal(e0 - p.energy, energyCost(p, wp));
});

test('burst: a rajada termina mesmo soltando o botão', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'burst', fireRate: 0.5, burst: { count: 4, interval: 0.1 } });
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  run(w, 0.5, { p1: { fire: false, aim: 0 } });
  assert.equal(countEvents(w, 'shoot'), 4);
});

test('charge: segurar não atira; soltar com carga cheia dá dano maxMul×', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'charge', damage: 4, fireRate: 2, charge: { time: 1, minMul: 0.4, maxMul: 2.5 } });
  run(w, 1.2, { p1: { fire: true, aim: 0 } });
  assert.equal(w.projectiles.length, 0);
  assert.equal(countEvents(w, 'charge_full'), 1);
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.projectiles.length, 1);
  assert.ok(Math.abs(w.projectiles[0].damage - 10) < 1e-9, `dano ${w.projectiles[0].damage}`);
  assert.equal(countEvents(w, 'charge_release'), 1);
});

test('charge: soltar cedo dá tiro fraco; carga cheia aplica perfuração e quantidade extra', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'charge', damage: 4, fireRate: 2, charge: { time: 1, fullPierce: 2, fullCount: 3 } });
  run(w, 0.2, { p1: { fire: true, aim: 0 } });
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.projectiles.length, 1);
  assert.ok(w.projectiles[0].damage < 4);
  p.fireCd = 0;
  w.projectiles = [];
  run(w, 1.1, { p1: { fire: true, aim: 0 } });
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.projectiles.length, 3);
  assert.equal(w.projectiles[0].pierce, 2);
});

test('spinup: segurando, o 2º segundo atira mais que o 1º', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'spinup', fireRate: 10, spinup: { startMul: 0.35, maxMul: 1.6, rampTime: 1.4 } });
  run(w, 1, { p1: { fire: true, aim: 0 } });
  const first = countEvents(w, 'shoot');
  run(w, 1, { p1: { fire: true, aim: 0 } });
  const second = countEvents(w, 'shoot') - first;
  assert.ok(second > first * 1.4, `1º ${first}, 2º ${second}`);
});

test('split: tiro que bate na parede vira 3 filhos com metade do dano, e filho não se divide', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'split', damage: 4, fireRate: 1, projectile: { speed: 600, range: 2000 }, split: { into: 3, childDamageMul: 0.5, spread: 60 } });
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  const t = wallDistRight(w, p) / 600 + 0.1;
  let kids = [];
  for (let i = 0; i < Math.ceil(t * 60) && !kids.length; i++) { run(w, 1 / 60); kids = w.projectiles.filter((q) => q.child); }
  assert.equal(kids.length, 3);
  for (const k of kids) { assert.equal(k.damage, 2); assert.equal(k.split, null); assert.ok(k.vx < 0, 'volta da parede'); }
});

test('singularity: o tiro vira área que puxa inimigo', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'singularity', fireRate: 1, projectile: { speed: 500, range: 2000 }, singularity: { pullRadius: 140, life: 2, dps: 4, pull: 170 } });
  dummy(w, p.x + 120, p.y, 9999);
  const far = dummy(w, p.x + 120, p.y + 90, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  run(w, 0.4);
  const area = w.areas.find((a) => a.kind === 'singularity');
  assert.ok(area, 'criou a área');
  const d0 = Math.hypot(far.x - area.x, far.y - area.y);
  run(w, 0.6);
  assert.ok(Math.hypot(far.x - area.x, far.y - area.y) < d0 - 20, 'puxou');
});

test('variants: 30 disparos usam pelo menos 2 variantes', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'variants', fireRate: 30, variants: { list: [{ speed: 200 }, { speed: 700, damageMul: 2 }] } });
  const keys = new Set();
  for (let i = 0; i < 60; i++) { run(w, 1 / 60, { p1: { fire: true, aim: 0 } }); for (const q of w.projectiles) keys.add(q.sprite); }
  assert.ok(keys.size >= 2, [...keys].join(','));
});

// ---------------------------------------------------------------- modos contínuos
import { T, TILE } from '../shared/sim/constants.js';

/** Põe uma coluna de parede 3 tiles de altura em x (px), na altura do jogador. */
function wallAt(w, p, x) {
  const tx = Math.floor(x / TILE), ty = Math.floor(p.y / TILE);
  for (let dy = -1; dy <= 1; dy++) w.map.set(tx, ty + dy, T.WALL);
}

test('beam acerta inimigo na linha e não acerta atrás da parede', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { dps: 20, tick: 0.1, range: 600, pierce: true, energyPerSec: 0 } });
  const a = dummy(w, p.x + 100, p.y, 9999);
  wallAt(w, p, p.x + 170);
  const b = dummy(w, p.x + 260, p.y, 9999);
  run(w, 1, { p1: { fire: true, aim: 0 } });
  assert.ok(a.hp < 9999 - 15, `a perdeu ${9999 - a.hp}`);
  assert.equal(b.hp, 9999);
  assert.equal(w.beams.length, 1);
  assert.ok(w.beams[0].x2 < p.x + 170, 'raio para na parede');
});

test('beam sem pierce para no primeiro inimigo', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { dps: 20, range: 600, energyPerSec: 0 } });
  const a = dummy(w, p.x + 100, p.y, 9999);
  const b = dummy(w, p.x + 160, p.y, 9999);
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.ok(a.hp < 9999);
  assert.equal(b.hp, 9999);
});

test('beam sem energia não liga e avisa; energia nunca fica negativa', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 6 } });
  p.energy = 0;
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 0);
  assert.ok(countEvents(w, 'no_energy') >= 1);
  assert.ok(p.energy >= 0);
});

test('beam gasta energia por segundo e para quando acaba', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 10 } });
  p.energy = 5;
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 1);
  assert.ok(p.energy < 5);
  run(w, 1, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 0, 'acabou a energia');
  assert.ok(p.energy >= 0);
});

test('beam some quando solta o botão', () => {
  const { w } = arena();
  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 0 } });
  run(w, 0.2, { p1: { fire: true, aim: 0 } });
  assert.equal(w.beams.length, 1);
  run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
  assert.equal(w.beams.length, 0);
});

test('flame acerta vários inimigos no cone e não passa da parede', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'flame', damage: 1, fireRate: 12, flame: { range: 140, arc: 40, particles: 2 } });
  const near = [dummy(w, p.x + 70, p.y - 15, 9999), dummy(w, p.x + 90, p.y + 15, 9999)];
  run(w, 1, { p1: { fire: true, aim: 0 } });
  for (const e of near) assert.ok(e.hp < 9999, 'queimou no cone');
  const { w: w2, p: p2 } = arena();
  withWeapon(w2, { mode: 'flame', damage: 1, fireRate: 12, flame: { range: 140, arc: 40, particles: 2 } });
  wallAt(w2, p2, p2.x + 50);
  const hidden = dummy(w2, p2.x + 100, p2.y, 9999);
  run(w2, 1, { p1: { fire: true, aim: 0 } });
  assert.equal(hidden.hp, 9999);
});

// ---------------------------------------------------------------- modos no chão
test('lob cai no ponto mirado e passa por cima de inimigo no caminho', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'lob', damage: 1, fireRate: 1, projectile: { explode: { radius: 40, damage: 10 } }, lob: { maxRange: 400, flightTime: 0.5 } });
  const mid = dummy(w, p.x + 80, p.y, 9999);
  const far = dummy(w, p.x + 200, p.y, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 200 } });
  run(w, 0.3);
  assert.equal(far.hp, 9999, 'ainda no ar');
  assert.ok(w.projectiles.some((q) => q.z > 0), 'tem altura');
  run(w, 0.4);
  assert.equal(mid.hp, 9999, 'passou por cima');
  assert.ok(far.hp < 9999, 'explodiu no alvo');
});

test('lob mirando dentro da parede cai antes da parede', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'lob', fireRate: 1, projectile: { explode: { radius: 30, damage: 5 } }, lob: { maxRange: 500, flightTime: 0.4 } });
  const wx = p.x + 150;
  for (let dy = -2; dy <= 2; dy++) w.map.set(Math.floor(wx / TILE), Math.floor(p.y / TILE) + dy, T.WALL);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 300 } });
  run(w, 0.6);
  const ex = w.events.find((e) => e.type === 'explosion');
  assert.ok(ex, 'explodiu');
  assert.ok(ex.x < Math.floor(wx / TILE) * TILE, `x ${ex.x}`);
  assert.ok(!w.map.solidAt(ex.x, ex.y));
});

test('pool envenena inimigo parado nela', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'lob', fireRate: 1, lob: { maxRange: 400, flightTime: 0.3, pool: { r: 50, life: 3, dps: 4, effect: { type: 'veneno', chance: 1, duration: 2, power: 2 } } } });
  const e = dummy(w, p.x + 150, p.y, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 150 } });
  run(w, 1.2);
  assert.ok(w.areas.some((a) => a.kind === 'pool'));
  assert.ok(e.status.poison, 'envenenado');
  assert.ok(e.hp < 9999);
});

test('rain marca o chão antes de causar dano', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'rain', damage: 5, fireRate: 1, rain: { count: 5, radius: 20, delay: 0.5, hitRadius: 40 } });
  const e = dummy(w, p.x + 150, p.y, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 150 } });
  assert.ok(w.areas.filter((a) => a.kind === 'rain_mark').length >= 5);
  assert.equal(e.hp, 9999);
  run(w, 1);
  assert.ok(e.hp < 9999);
});

test('chain acerta o mais próximo da mira e pula para 2 vizinhos com dano menor', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'chain', damage: 10, fireRate: 1, chain: { range: 300, chains: 2, radius: 130, falloff: 0.8, aimCone: 35 } });
  const a = dummy(w, p.x + 150, p.y, 9999);
  const b = dummy(w, p.x + 150, p.y + 90, 9999);
  const c = dummy(w, p.x + 150, p.y + 180, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  for (const e of [a, b, c]) assert.ok(e.hp < 9999);
  assert.ok(9999 - c.hp < 9999 - a.hp, 'o último salto bate menos');
  assert.equal(countEvents(w, 'chain'), 1);
});

test('chain sem alvo não gasta energia', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'chain', energyCost: 3, fireRate: 2 });
  const e0 = p.energy;
  run(w, 0.5, { p1: { fire: true, aim: 0 } });
  assert.equal(p.energy, e0);
  assert.ok(countEvents(w, 'chain') >= 1, 'mostra a faísca curta');
});

// ---------------------------------------------------------------- deploy e órbita
import { spawnProjectile } from '../shared/sim/armas/Projectiles.js';

const mines = (w) => w.allies.filter((a) => a.kind === 'mine' && !a.dead);

test('mina explode quando inimigo passa', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'deploy', fireRate: 1, deploy: { kind: 'mine', max: 3, radius: 60, damage: 12, triggerRadius: 28 } });
  run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 60 } });
  assert.equal(mines(w).length, 1);
  const m = mines(w)[0];
  run(w, 0.6);
  const e = dummy(w, m.x + 10, m.y, 9999);
  run(w, 2 / 60);
  assert.ok(e.hp < 9999, 'explodiu');
  assert.equal(mines(w).length, 0);
});

test('deploy respeita o máximo: a 4ª mina remove a 1ª', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'deploy', fireRate: 10, deploy: { kind: 'mine', max: 3 } });
  const placed = [];
  for (let i = 0; i < 4; i++) {
    p.fireCd = 0;
    run(w, 1 / 60, { p1: { fire: true, aim: (i * Math.PI) / 2, aimDist: 60 } });
    run(w, 1 / 60, { p1: { fire: false } });
    placed.push(Math.max(...mines(w).map((a) => a.id)));
  }
  const ids = mines(w).map((a) => a.id);
  assert.equal(ids.length, 3);
  assert.ok(!ids.includes(placed[0]));
});

test('torreta atira sozinha e some ao fim da vida', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'deploy', fireRate: 1, deploy: { kind: 'turret', max: 1, life: 2, fireRate: 3, damage: 3, range: 300 } });
  const e = dummy(w, p.x + 150, p.y + 60, 9999);
  run(w, 1 / 60, { p1: { fire: true, aim: Math.PI, aimDist: 40 } });
  run(w, 1.5);
  assert.ok(e.hp < 9999, 'torreta acertou');
  run(w, 1);
  assert.equal(w.allies.filter((a) => a.kind === 'turret').length, 0);
});

test('órbita protege: bala inimiga que encosta some', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'orbit', fireRate: 5, orbit: { max: 4, radius: 34, spin: 4 } });
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  const o = w.projectiles.find((q) => q.orbit);
  assert.ok(o, 'em órbita');
  run(w, 1 / 60);
  const b = spawnProjectile(w, { team: 'enemy', x: o.x, y: o.y, angle: 0, speed: 1, damage: 1, range: 900, sprite: 'ebullet_paper' });
  run(w, 2 / 60);
  assert.ok(b.dead);
  assert.ok(!o.dead, 'continua girando');
});

test('com 4 em órbita, o próximo disparo lança todos', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'orbit', fireRate: 10, orbit: { max: 4, launchSpeed: 480 } });
  const orbiting = () => w.projectiles.filter((q) => q.orbit && !q.dead).length;
  for (let i = 0; i < 60 && orbiting() < 4; i++) run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  assert.equal(orbiting(), 4);
  for (let i = 0; i < 60 && orbiting() === 4; i++) run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  const flying = w.projectiles.filter((q) => !q.orbit && !q.dead && q.team === 'player');
  assert.equal(flying.length, 4);
  for (const q of flying) assert.ok(q.vx > 300, 'na direção da mira');
});

test('trocar de arma com projéteis em órbita lança eles', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'orbit', fireRate: 10 });
  p.weapons.push('pistola_grampos');
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  assert.ok(w.projectiles.some((q) => q.orbit));
  run(w, 1 / 60, { p1: { swap: true, aim: 0 } });
  assert.ok(!w.projectiles.some((q) => q.orbit && !q.dead));
});

test('trocar de andar com minas, órbitas, raio e arremesso no ar não dá erro', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'deploy', fireRate: 10, deploy: { kind: 'turret' } });
  run(w, 0.1, { p1: { fire: true, aim: 0, aimDist: 60 } });
  withWeapon(w, { mode: 'orbit', fireRate: 10 });
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  withWeapon(w, { mode: 'lob', fireRate: 10, lob: { flightTime: 2 } });
  run(w, 0.1, { p1: { fire: true, aim: 0, aimDist: 300 } });
  withWeapon(w, { mode: 'beam', beam: { energyPerSec: 0 } });
  run(w, 0.1, { p1: { fire: true, aim: 0 } });
  assert.ok(w.allies.length && w.projectiles.length && w.beams.length);
  w.completeFloor();
  assert.equal(w.allies.length, 0);
  assert.equal(w.projectiles.length, 0);
  assert.equal(w.beams.length, 0);
  run(w, 1, { p1: { fire: true, aim: 0 } });
  assert.equal(w.floorNum, 2);
});

// ---------------------------------------------------------------- corpo a corpo
import { hurtPlayer } from '../shared/sim/combat.js';

const meleeDef = (style, extra = {}) => ({ type: 'melee', category: 'corpo', damage: 6, fireRate: 10, melee: { style, range: 50, arc: 110, knockback: 0, ...extra } });

test('estocada avança, acerta o inimigo no caminho uma vez e para no fim', () => {
  const { w, p } = arena();
  withWeapon(w, { ...meleeDef('thrust', { thrust: { distance: 110, time: 0.16 } }), fireRate: 1 });
  const e = dummy(w, p.x + 60, p.y, 9999);
  const x0 = p.x;
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  assert.ok(p.dash, 'começou a estocada');
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  assert.equal(p.dash, null);
  assert.ok(p.x - x0 > 90, `andou ${p.x - x0}`);
  assert.equal(e.hp, 9999 - 6, 'um acerto só');
});

test('estocada para na parede e não entra nela', () => {
  const { w, p } = arena();
  withWeapon(w, { ...meleeDef('thrust'), fireRate: 1 });
  const wx = p.x + 40;
  for (let dy = -2; dy <= 2; dy++) w.map.set(Math.floor(wx / TILE), Math.floor(p.y / TILE) + dy, T.WALL);
  run(w, 0.4, { p1: { fire: true, aim: 0 } });
  assert.ok(!w.map.boxSolid(p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r), 'fora da parede');
  assert.ok(p.x < Math.floor(wx / TILE) * TILE);
});

test('estocada deixa invulnerável durante o avanço', () => {
  const { w, p } = arena();
  withWeapon(w, { ...meleeDef('thrust'), fireRate: 1 });
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  const hp = p.hp, sh = p.shield;
  assert.equal(hurtPlayer(w, p, 1), false);
  assert.equal(p.hp, hp); assert.equal(p.shield, sh);
});

test('combo: o 3º golpe dá dano em dobro; parar 1 s volta ao 1º', () => {
  const { w, p } = arena();
  withWeapon(w, meleeDef('combo'));
  const e = dummy(w, p.x + 30, p.y, 9999);
  const hits = () => w.events.filter((ev) => ev.type === 'dmg' && ev.id === e.id).map((ev) => ev.amount);
  for (let i = 0; i < 60 && hits().length < 3; i++) run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  const [a, b, c] = hits();
  assert.equal(a, 6); assert.equal(b, 6); assert.equal(c, 12);
  run(w, 1, { p1: { fire: false, aim: 0 } });
  const before = hits().length;
  for (let i = 0; i < 30 && hits().length === before; i++) run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  assert.equal(hits()[before], 6, 'voltou ao 1º golpe');
});

test('escudo bloqueia bala de frente e gasta energia; bala pelas costas acerta', () => {
  const { w, p } = arena();
  withWeapon(w, meleeDef('shield', { shield: { arc: 110, blockCost: 1 } }));
  run(w, 2 / 60, { p1: { fire: true, aim: 0 } });
  assert.equal(p.wstate.shielding, true);
  const e0 = p.energy, sh = p.shield, hp = p.hp;
  spawnProjectile(w, { team: 'enemy', x: p.x + 40, y: p.y, angle: Math.PI, speed: 300, damage: 1, range: 900, sprite: 'ebullet_paper' });
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  assert.equal(p.shield, sh); assert.equal(p.hp, hp);
  assert.ok(p.energy < e0);
  assert.equal(countEvents(w, 'block'), 1);
  spawnProjectile(w, { team: 'enemy', x: p.x - 40, y: p.y, angle: 0, speed: 300, damage: 1, range: 900, sprite: 'ebullet_paper' });
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  assert.ok(p.shield < sh || p.hp < hp, 'acertou pelas costas');
});

test('escudo sem energia não bloqueia', () => {
  const { w, p } = arena();
  withWeapon(w, meleeDef('shield'));
  p.energy = 0;
  run(w, 2 / 60, { p1: { fire: true, aim: 0 } });
  const sh = p.shield, hp = p.hp;
  spawnProjectile(w, { team: 'enemy', x: p.x + 40, y: p.y, angle: Math.PI, speed: 300, damage: 1, range: 900, sprite: 'ebullet_paper' });
  run(w, 0.3, { p1: { fire: true, aim: 0 } });
  assert.ok(p.shield < sh || p.hp < hp);
});

test('escudo deixa o jogador mais lento', () => {
  const a = arena(), b = arena();
  withWeapon(a.w, meleeDef('shield', { shield: { speedMul: 0.5 } }));
  withWeapon(b.w, meleeDef('shield', { shield: { speedMul: 0.5 } }));
  const ax = a.p.x, bx = b.p.x;
  run(a.w, 0.3, { p1: { fire: true, aim: 0, moveX: 1 } });
  run(b.w, 0.3, { p1: { fire: false, aim: 0, moveX: 1 } });
  assert.ok(a.p.x - ax < (b.p.x - bx) * 0.7);
});

test('cair no meio da estocada ou com escudo levantado limpa o estado', () => {
  const { w, p } = arena();
  withWeapon(w, meleeDef('shield'));
  run(w, 2 / 60, { p1: { fire: true, aim: 0 } });
  assert.ok(p.wstate.shielding);
  p.shield = 0; hurtPlayer(w, p, 99);
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  assert.equal(p.wstate.shielding, false);
  const t = arena();
  withWeapon(t.w, { ...meleeDef('thrust', { thrust: { distance: 200, time: 0.5 } }), fireRate: 1 });
  run(t.w, 1 / 60, { p1: { fire: true, aim: 0 } });
  assert.ok(t.p.dash);
  t.p.jailTimer = 2;
  run(t.w, 1 / 60);
  assert.equal(t.p.dash, null);
});

// ---------------------------------------------------------------- todas as armas do jogo
test('toda arma dispara 5 s sem erro e funciona contra um alvo', () => {
  const ids = [...data.weapons.keys()].filter((id) => !id.startsWith('t_'));
  for (const id of ids) {
    const { w, p } = arena();
    const wp = data.weapon(id);
    p.weapons = [id];
    const e = dummy(w, p.x + 110, p.y, 1e6);
    if (wp.type === 'melee' && wp.melee.style !== 'thrust') { e.x = p.x + 30; }
    if (wp.mode === 'deploy') { e.x = p.x + 40; }
    if (wp.type === 'melee' && wp.melee.style === 'shield') {
      // escudo: bloqueia de frente e empurra ao soltar
      run(w, 0.2, { p1: { fire: true, aim: 0 } });
      spawnProjectile(w, { team: 'enemy', x: p.x + 40, y: p.y, angle: Math.PI, speed: 300, damage: 1, range: 900, sprite: 'ebullet_paper' });
      run(w, 0.3, { p1: { fire: true, aim: 0 } });
      assert.ok(countEvents(w, 'block') >= 1, `${id}: bloqueou`);
      run(w, 1 / 60, { p1: { fire: false, aim: 0 } });
      assert.ok(e.hp < 1e6, `${id}: empurrão causa dano`);
      continue;
    }
    for (let i = 0; i < 300; i++) {
      // segura e solta (para armas de carregar), mirando no alvo
      const fire = wp.mode === 'charge' ? i % 80 < 70 : true;
      run(w, 1 / 60, { p1: { fire, aim: Math.atan2(e.y - p.y, e.x - p.x), aimDist: Math.hypot(e.x - p.x, e.y - p.y) } });
      if (wp.type === 'melee' && wp.melee.style === 'thrust' && !p.dash) { p.x = e.x - 90; p.y = e.y; }
    }
    assert.ok(e.hp < 1e6, `${id} (${wp.mode || wp.melee.style}) não causou dano`);
  }
});

test('globo bumerangue volta 50% maior e mais forte', () => {
  const { w, p } = arena();
  p.weapons = ['globo_bumerangue'];
  run(w, 1 / 60, { p1: { fire: true, aim: 0 } });
  const g = w.projectiles[0];
  const r0 = g.r, d0 = g.damage;
  for (let i = 0; i < 120 && !g.returning; i++) run(w, 1 / 60);
  assert.ok(g.returning);
  assert.ok(Math.abs(g.r - r0 * 1.5) < 1e-9 && Math.abs(g.damage - d0 * 1.5) < 1e-9);
});

test('laser com dano fracionado não perde dano no arredondamento', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'beam', critChance: 0, beam: { dps: 14, tick: 0.1, energyPerSec: 0 } });
  const e = dummy(w, p.x + 100, p.y, 9999);
  run(w, 2, { p1: { fire: true, aim: 0 } });
  const dealt = 9999 - e.hp;
  assert.ok(dealt >= 26 && dealt <= 30, `causou ${dealt} em 2 s (esperado ~28)`);
});

test('poças da mesma arma não empilham dano', () => {
  const { w, p } = arena();
  const e = dummy(w, p.x + 100, p.y, 9999);
  const { createArea } = areasMod;
  for (let i = 0; i < 5; i++) createArea(w, 'pool', e.x, e.y, { r: 40, life: 3, dps: 4, effect: null, slowMul: 1, style: 'paint', ownerId: p.id });
  run(w, 2);
  const dealt = 9999 - e.hp;
  assert.ok(dealt <= 9, `5 poças sobrepostas causaram ${dealt} em 2 s (uma só causaria 8)`);
});

test('órbita lança os projéteis em direção ao ponto mirado', () => {
  const { w, p } = arena();
  withWeapon(w, { mode: 'orbit', damage: 5, fireRate: 10, orbit: { max: 4, launchSpeed: 500 } });
  const e = dummy(w, p.x + 140, p.y, 9999);
  const orbiting = () => w.projectiles.filter((q) => q.orbit && !q.dead).length;
  for (let i = 0; i < 60 && orbiting() < 4; i++) run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 140 } });
  for (let i = 0; i < 30 && orbiting() === 4; i++) run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 140 } });
  run(w, 0.6, { p1: { fire: false, aim: 0, aimDist: 140 } });
  assert.ok(9999 - e.hp >= 15, `acertou ${9999 - e.hp} (4 projéteis de 5)`);
});

// ---------------------------------------------------------------- arremesso/chuva passam por cima de obstáculos
for (const [nome, tile] of [['obstáculo', T.OBSTACLE], ['caixa', T.PROP]]) {
  test(`lob passa por cima de ${nome} e cai no ponto mirado`, () => {
    const { w, p } = arena();
    withWeapon(w, { mode: 'lob', damage: 1, fireRate: 1, projectile: { explode: { radius: 30, damage: 10 } }, lob: { maxRange: 400, flightTime: 0.4 } });
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    w.map.set(tx + 2, ty, tile);
    const e = dummy(w, p.x + 4 * TILE, p.y, 9999);
    run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 4 * TILE } });
    run(w, 0.8);
    assert.ok(e.hp < 9999, 'explodiu atrás do ' + nome);
  });

  test(`rain passa por cima de ${nome}`, () => {
    const { w, p } = arena();
    withWeapon(w, { mode: 'rain', damage: 5, fireRate: 1, rain: { count: 5, radius: 10, delay: 0.3, hitRadius: 40 } });
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    w.map.set(tx + 2, ty, tile);
    const e = dummy(w, p.x + 4 * TILE, p.y, 9999);
    run(w, 1 / 60, { p1: { fire: true, aim: 0, aimDist: 4 * TILE } });
    run(w, 0.8);
    assert.ok(e.hp < 9999, 'choveu atrás do ' + nome);
  });
}
