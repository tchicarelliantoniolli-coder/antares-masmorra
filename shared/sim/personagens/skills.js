import { spawnProjectile } from '../armas/Projectiles.js';
import { createArea } from '../areas.js';
import { createAlly } from './Allies.js';


/**
 * Habilidades especiais (tecla Espaço). Cada função recebe (world, player) e devolve true se foi usada.
 * Etapa 1: Nota Mil (Ana Cláudia) e Equação (Harilson). As outras entram na Etapa 3.
 */
/** Cria os aliados em arco à frente do jogador (ou em cima dele, se for parede). */
function summon(world, p, skill, kinds) {
  kinds.forEach((kind, i) => {
    const ang = p.aim + (i - (kinds.length - 1) / 2) * 0.9;
    let x = p.x + Math.cos(ang) * 44, y = p.y + Math.sin(ang) * 44;
    if (world.map.solidAt(x, y)) { x = p.x; y = p.y; }
    createAlly(world, kind, x, y, { life: 10 * p.mods.allyLifeMul, ownerId: p.id });
  });
  world.emit('skill', { playerId: p.id, skill, x: p.x, y: p.y });
}

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
  },

  // Filipe — apita o "Pique": +60% de velocidade e de cadência para o time todo por 5 s.
  pique(world, p) {
    for (const q of world.players) if (!q.dead && !q.downed) q.buffs.hasteTimer = 5;
    world.emit('skill', { playerId: p.id, skill: 'pique', x: p.x, y: p.y });
    return true;
  },

  // Jean Paulo — campo gravitacional que puxa os inimigos e causa dano.
  campo_gravitacional(world, p) {
    const d = 150;
    let x = p.x + Math.cos(p.aim) * d, y = p.y + Math.sin(p.aim) * d;
    if (!world.map.lineOfSight(p.x, p.y, x, y)) { x = p.x + Math.cos(p.aim) * 60; y = p.y + Math.sin(p.aim) * 60; }
    createArea(world, 'gravity', x, y, { r: 125, life: 3.5, ownerId: p.id });
    world.emit('skill', { playerId: p.id, skill: 'campo_gravitacional', x, y });
    return true;
  },

  // Vivian — planta carnívora que funciona como torreta por 12 s.
  planta_carnivora(world, p) {
    let x = p.x + Math.cos(p.aim) * 30, y = p.y + Math.sin(p.aim) * 30;
    if (world.map.solidAt(x, y)) { x = p.x; y = p.y; }
    createAlly(world, 'planta', x, y, { life: 12 * p.mods.allyLifeMul, ownerId: p.id });
    world.emit('skill', { playerId: p.id, skill: 'planta_carnivora', x, y });
    return true;
  },

  // Felipe — legionário, cavaleiro e bandeirante por 10 s (×allyLifeMul).
  exercito_historico(world, p) {
    summon(world, p, 'exercito_historico', ['legionario', 'cavaleiro', 'bandeirante']);
    return true;
  },

  // Tatiane — Capitu, Macunaíma e Policarpo por 10 s (×allyLifeMul).
  classicos_vivos(world, p) {
    summon(world, p, 'classicos_vivos', ['capitu', 'macunaima', 'policarpo']);
    return true;
  },

  // Marina — Grammar Shield: bolha de letras em todo o time que apaga balas por 4 s.
  grammar_shield(world, p) {
    for (const q of world.players) if (!q.dead && !q.downed) q.buffs.bubbleTimer = 4;
    world.emit('skill', { playerId: p.id, skill: 'grammar_shield', x: p.x, y: p.y });
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
