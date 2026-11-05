import { spawnShot } from '../shots.js';
import { tryPay, fireCooldown, emitShoot, fireRateMul } from '../common.js';

/** Dispara um tiro normal se a recarga e a energia deixarem. Devolve true se disparou. */
export function basicFire(world, p, w, opts) {
  if (p.fireCd > 0 || !tryPay(world, p, w)) return false;
  spawnShot(world, p, w, opts);
  fireCooldown(world, p, w);
  emitShoot(world, p, w);
  return true;
}

/** Tiro atual: segura e atira na cadência da arma. Também serve para split e singularity (o projétil é que muda). */
export const shot = {
  hold(world, p, w) { basicFire(world, p, w); }
};

/** Rajada: um disparo solta vários tiros seguidos; a energia é paga uma vez. */
function burstTick(world, p, w, dt) {
  const ws = p.wstate;
  if (ws.burstLeft <= 0) return;
  ws.burstT -= dt;
  while (ws.burstT <= 0 && ws.burstLeft > 0) {
    spawnShot(world, p, w);
    emitShoot(world, p, w);
    ws.burstLeft--;
    ws.burstT += w.burst.interval;
  }
  if (ws.burstLeft <= 0) fireCooldown(world, p, w);
}
export const burst = {
  hold(world, p, w, dt) {
    const ws = p.wstate;
    if (ws.burstLeft > 0) return burstTick(world, p, w, dt);
    if (p.fireCd > 0 || !tryPay(world, p, w)) return;
    spawnShot(world, p, w);
    emitShoot(world, p, w);
    ws.burstLeft = w.burst.count - 1;
    ws.burstT = w.burst.interval;
    if (ws.burstLeft <= 0) fireCooldown(world, p, w);
  },
  idle(world, p, w, dt) { burstTick(world, p, w, dt); }
};

/** Carregar: segurando enche a carga; soltando, o tiro sai mais forte quanto maior a carga. */
export const charge = {
  hold(world, p, w, dt) {
    const ws = p.wstate;
    if (p.fireCd > 0 && ws.charge === 0) return;
    ws.charge = Math.min(1, ws.charge + (dt * fireRateMul(p)) / w.charge.time);
    if (ws.charge >= 1 && !ws.chargeFull) {
      ws.chargeFull = true;
      world.emit('charge_full', { playerId: p.id, x: p.x, y: p.y });
    }
  },
  release(world, p, w) {
    const ws = p.wstate;
    const c = w.charge;
    const level = ws.charge;
    const full = ws.chargeFull;
    ws.charge = 0;
    ws.chargeFull = false;
    if (level <= 0.05 || !tryPay(world, p, w)) return;
    spawnShot(world, p, w, {
      damageMul: c.minMul + (c.maxMul - c.minMul) * level,
      speedMul: 0.8 + 0.4 * level,
      extraPierce: full ? c.fullPierce : 0,
      extraBounce: full ? c.fullBounce : 0,
      countOverride: full && c.fullCount > 1 ? c.fullCount : undefined
    });
    fireCooldown(world, p, w);
    emitShoot(world, p, w, { charge: level });
    world.emit('charge_release', { playerId: p.id, level, x: p.x, y: p.y });
  }
};

/** Aquecimento: a cadência começa baixa e sobe enquanto segura; cai ao soltar. */
export const spinup = {
  hold(world, p, w, dt) {
    const ws = p.wstate;
    const s = w.spinup;
    ws.spin = Math.min(1, ws.spin + dt / s.rampTime);
    if (p.fireCd > 0 || !tryPay(world, p, w)) return;
    spawnShot(world, p, w);
    fireCooldown(world, p, w, 1 / (s.startMul + (s.maxMul - s.startMul) * ws.spin));
    emitShoot(world, p, w);
  },
  idle(world, p, w, dt) {
    p.wstate.spin = Math.max(0, p.wstate.spin - (2 * dt) / w.spinup.rampTime);
  }
};

/** Sorteio: cada disparo usa uma variante de projétil diferente. */
export const variants = {
  hold(world, p, w) {
    if (p.fireCd > 0) return;
    basicFire(world, p, w, { proj: world.rng.pick(w.variants.list) });
  }
};
