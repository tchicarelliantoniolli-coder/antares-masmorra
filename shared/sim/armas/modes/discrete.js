import { spawnShot } from '../shots.js';
import { tryPay, startCooldown, emitShoot } from '../common.js';

/** Dispara um tiro normal se a recarga e a energia deixarem. Devolve true se disparou. */
export function basicFire(world, p, w, opts) {
  if (p.fireCd > 0 || !tryPay(world, p, w)) return false;
  spawnShot(world, p, w, opts);
  startCooldown(p, w);
  if (p.mods.doubleShot && world.rng.chance(p.mods.doubleShot)) p.fireCd *= 0.35; // passivo Bilíngue
  emitShoot(world, p, w);
  return true;
}

/** Tiro atual: segura e atira na cadência da arma. */
export const shot = {
  hold(world, p, w) { basicFire(world, p, w); }
};
