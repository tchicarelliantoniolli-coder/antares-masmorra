/** Peças comuns a todos os modos de arma (energia, recarga, estado). */

/** Custo de energia real (com passivos). */
export function energyCost(p, w) {
  return w.energyCost * p.mods.energyCostMul;
}

/** Desconta a energia; sem energia, avisa (no máximo a cada 0,6 s) e devolve false. */
export function tryPay(world, p, w, cost = energyCost(p, w)) {
  if (p.energy < cost) {
    if (p.noEnergyCd <= 0) {
      world.emit('no_energy', { playerId: p.id, x: p.x, y: p.y });
      p.noEnergyCd = 0.6;
    }
    return false;
  }
  p.energy -= cost;
  return true;
}

/** Multiplicador de cadência do jogador (passivos, bênçãos, Pique). */
export function fireRateMul(p) {
  return p.mods.fireRateMul * (p.buffs.hasteTimer > 0 ? 1.6 : 1);
}

/** Inicia a recarga entre disparos. mul > 1 = espera mais. */
export function startCooldown(p, w, mul = 1) {
  p.fireCd = mul / (w.fireRate * fireRateMul(p));
}

export function critChanceOf(p, w) {
  return w.critChance + p.mods.critBonus;
}

/** Estado da arma na mão (zera ao trocar ou pegar outra arma). */
export function newWeaponState(weaponId) {
  return { weaponId, charge: 0, chargeFull: false, spin: 0, burstLeft: 0, burstT: 0, combo: 0, comboT: 0, shielding: false };
}

/** Avisa o renderizador/sons que a arma disparou. */
export function emitShoot(world, p, w, extra = {}) {
  world.stats.shots++;
  world.emit('shoot', { playerId: p.id, weaponId: w.id, category: w.category, wtype: w.type, mode: w.type === 'melee' ? w.melee.style : w.mode, x: p.x, y: p.y, angle: p.aim, ...extra });
}
