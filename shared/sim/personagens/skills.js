import { spawnProjectile } from '../armas/Projectiles.js';
import { createArea } from '../areas.js';
import { createAlly } from './Allies.js';
import { aimPoint } from '../armas/modes/ground.js';
import { damageEnemy, applyEffect } from '../combat.js';


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
  },

  // Andréia — inimigos a até 180 px ficam confusos por 4 s (atacam os colegas); chefes só ficam lentos.
  translate(world, p) {
    for (const e of world.enemies) {
      if (e.dead || e.def.invulnerable || Math.hypot(e.x - p.x, e.y - p.y) > 180) continue;
      if (e.def.boss) { e.status.slow = Math.max(e.status.slow || 0, 2); e.status.slowMul = 0.6; }
      else e.status.confused = 4;
    }
    world.emit('skill', { playerId: p.id, skill: 'translate', x: p.x, y: p.y });
    return true;
  },

  // Vinícius — liga até 6 inimigos a até 220 px: o dano em um vai pela metade para os outros.
  circuito(world, p) {
    const id = world.newId();
    const alvos = world.enemies
      .filter((e) => !e.dead && !e.def.invulnerable && Math.hypot(e.x - p.x, e.y - p.y) <= 220)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, 6);
    for (const e of alvos) e.linked = { until: world.time + 6, id };
    world.emit('skill', { playerId: p.id, skill: 'circuito', x: p.x, y: p.y });
    return true;
  },

  // William — alterna a cada uso: Terremoto (atordoa a sala) e Vulcão (área de lava no ponto mirado).
  terremoto(world, p) {
    const modo = p.buffs.quakeNext === 'vulcao' ? 'vulcao' : 'terremoto';
    p.buffs.quakeNext = modo === 'vulcao' ? 'terremoto' : 'vulcao';
    if (modo === 'terremoto') {
      for (const e of world.enemies) {
        if (e.dead || e.spawning > 0 || e.roomId !== p.roomId) continue;
        applyEffect(world, e, { type: 'atordoar', duration: 1.5 }, p);
        damageEnemy(world, e, 8, { source: p, noMul: true });
      }
      world.emit('quake', { x: p.x, y: p.y });
      world.emit('skill', { playerId: p.id, skill: 'terremoto', x: p.x, y: p.y });
    } else {
      const c = aimPoint(world, p, 260);
      createArea(world, 'volcano', c.x, c.y, { r: 90, life: 4, ownerId: p.id });
      world.emit('skill', { playerId: p.id, skill: 'vulcao', x: c.x, y: c.y });
    }
    return true;
  },

  // Gabriela P. — pinta no chão (raio 140, 6 s): inimigos em cima andam a 30%.
  obra_prima(world, p) {
    const c = aimPoint(world, p, 200);
    createArea(world, 'painting', c.x, c.y, { r: 140, life: 6, slowMul: 0.3, ownerId: p.id });
    world.emit('skill', { playerId: p.id, skill: 'obra_prima', x: c.x, y: c.y });
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
