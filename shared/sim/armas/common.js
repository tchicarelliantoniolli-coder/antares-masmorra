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

/** Recarga de um disparo de arma de longe; o passivo Bilíngue às vezes encurta a espera (quase um segundo tiro). */
export function fireCooldown(world, p, w, mul = 1) {
  startCooldown(p, w, mul);
  if (p.mods.doubleShot && world.rng.chance(p.mods.doubleShot)) p.fireCd *= 0.35;
}

export function critChanceOf(p, w) {
  return w.critChance + p.mods.critBonus;
}

/** Estado da arma na mão (zera ao trocar ou pegar outra arma). */
export function newWeaponState(weaponId) {
  return { weaponId, charge: 0, chargeFull: false, spin: 0, burstLeft: 0, burstT: 0, combo: 0, comboT: 0, shielding: false, beamAcc: 0, beamT: 0 };
}

/** Avisa o renderizador/sons que a arma disparou. */
export function emitShoot(world, p, w, extra = {}) {
  world.stats.shots++;
  world.emit('shoot', { playerId: p.id, weaponId: w.id, category: w.category, wtype: w.type, mode: w.type === 'melee' ? w.melee.style : w.mode, x: p.x, y: p.y, angle: p.aim, ...extra });
}

/** Texto de energia para o HUD e o card: por disparo, ou por segundo no laser. */
export function energyText(p, w) {
  if (w.mode === 'beam') {
    const eps = w.beam.energyPerSec * p.mods.energyCostMul;
    return eps > 0 ? `${Number.isInteger(eps) ? eps : eps.toFixed(1)}/s` : 'grátis';
  }
  if (w.type === 'melee' && w.melee.style === 'shield') {
    const c = w.melee.shield.blockCost * p.mods.energyCostMul;
    return `${Number.isInteger(c) ? c : c.toFixed(1)} por bloqueio`;
  }
  const c = energyCost(p, w);
  return c === 0 ? 'grátis' : Number.isInteger(c) ? String(c) : c.toFixed(2);
}
