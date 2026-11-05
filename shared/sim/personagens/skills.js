import { spawnProjectile } from '../armas/Projectiles.js';

/**
 * Habilidades especiais (tecla Espaço). Cada função recebe (world, player) e devolve true se foi usada.
 * Etapa 1: Nota Mil (Ana Cláudia) e Equação (Harilson). As outras entram na Etapa 3.
 */
export const SKILLS = {
  // Ana Cláudia — um texto gigante "1000" que atravessa a tela, paredes e inimigos, apagando balas.
  nota_mil(world, p) {
    spawnProjectile(world, {
      team: 'player', owner: p,
      x: p.x + Math.cos(p.aim) * 20, y: p.y + Math.sin(p.aim) * 20 - 4,
      angle: p.aim, speed: 420, radius: 34,
      damage: 30, crit: false, range: 1400, pierce: 999,
      ghost: true, deflects: true, knockback: 260,
      sprite: 'proj_nota_mil'
    });
    world.emit('skill', { playerId: p.id, skill: 'nota_mil', x: p.x, y: p.y, angle: p.aim });
    return true;
  },

  // Harilson — o próximo inimigo atingido leva dano x5.
  equacao(world, p) {
    p.buffs.nextHitMul = 5;
    p.buffs.nextHitTimer = 12;
    world.emit('skill', { playerId: p.id, skill: 'equacao', x: p.x, y: p.y });
    return true;
  }
};

export function castSkill(world, p) {
  const fn = SKILLS[p.skillId];
  if (!fn) {
    world.emit('skill_missing', { playerId: p.id, skill: p.skillId });
    return false;
  }
  return fn(world, p);
}
