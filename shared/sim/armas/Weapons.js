import { MODES } from './modes/index.js';
import { MELEE_STYLES } from './melee.js';
import { newWeaponState } from './common.js';

export { energyCost, tryPay, startCooldown } from './common.js';

/** Zera o estado da arma na mão (troca de arma, cair, ser preso...). */
export function resetWeaponState(p) {
  p.wstate = newWeaponState(p.weapons[p.cur]);
}

function handlerFor(w) {
  return w.type === 'melee' ? MELEE_STYLES[w.melee.style] : MODES[w.mode];
}

/**
 * Roda a arma do jogador a cada passo: segurando → hold; sem segurar → idle; acabou de soltar → release.
 * O estado da arma (carga, aquecimento, rajada...) zera quando a arma na mão muda.
 */
export function updateWeapon(world, p, inp, dt) {
  const id = p.weapons[p.cur];
  if (!p.wstate || p.wstate.weaponId !== id) resetWeaponState(p);
  p.fireCd -= dt;
  const w = world.data.weapon(id);
  const h = handlerFor(w);
  const holding = !!inp.fire && !(p.signing > 0);
  if (holding) h.hold(world, p, w, dt);
  else h.idle?.(world, p, w, dt);
  if (p.prevFire && !holding) h.release?.(world, p, w);
  p.prevFire = holding;
}
