/** Mira automática: inimigo vivo mais próximo com linha de visão. Devolve { angle, dist } ou null. */
export function autoAim(world, p) {
  if (!world) return null;
  let best = null, bd = 420;
  for (const e of world.enemies) {
    if (e.dead || e.spawning > 0 || e.def?.invulnerable) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && world.map.lineOfSight(p.x, p.y, e.x, e.y)) { bd = d; best = e; }
  }
  return best ? { angle: Math.atan2(best.y - p.y, best.x - p.x), dist: bd } : null;
}
