import { createArea } from '../areas.js';
import { createEnemy } from './Enemy.js';

const SHIELD_REGEN = 6;   // segundos sem dano para o escudo do "blindado" voltar

/**
 * Modificadores de elite. Cada um: { label, color, onCreate?, onUpdate?, onHit?, onDamaged?, onDeath? }.
 * onHit é chamado quando o inimigo fere um jogador (contato ou bala).
 */
export const AFFIXES = {
  rapido: {
    label: 'Rápido', color: 0x5ee0ff,
    onCreate(world, e) { e.speedMul *= 1.4; e.atkMul *= 0.8; }
  },
  blindado: {
    label: 'Blindado', color: 0x9aa8c8,
    onCreate(world, e) { e.shielded = 1; e.shieldHit = true; e.shieldT = SHIELD_REGEN; },
    onDamaged(world, e) { e.shieldT = SHIELD_REGEN; },
    onUpdate(world, e, dt) {
      if (e.shielded > 0) return;
      e.shieldT -= dt;
      if (e.shieldT <= 0) { e.shielded = 1; e.shieldHit = true; e.shieldT = SHIELD_REGEN; }
    }
  },
  explosivo: {
    label: 'Explosivo', color: 0xff7a2e,
    onDeath(world, e) {
      createArea(world, 'warn_circle', e.x, e.y, { r: 60, life: 0.7, blast: { damage: 2 } });
    }
  },
  vampiro: {
    label: 'Vampiro', color: 0xc02060,
    onHit(world, e) {
      if (e.dead) return;
      e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.25));
      world.emit('enemy_heal', { x: e.x, y: e.y - e.r, id: e.id });
    }
  },
  duplicador: {
    label: 'Duplicador', color: 0x7ae07a,
    onDamaged(world, e) {
      if (e.splitDone || e.dead || e.hp <= 0 || e.hp > e.maxHp * 0.5) return;
      e.splitDone = true;
      // procura um ponto livre ao redor (copia tem o raio base, sem o aumento de elite); sem vaga, nasce no lugar do original
      const r = e.def.radius, d = e.r * 2.2;
      let x = e.x, y = e.y;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4, cx = e.x + Math.cos(a) * d, cy = e.y + Math.sin(a) * d;
        if (!world.map.boxSolid(cx - r, cy - r, cx + r, cy + r)) { x = cx; y = cy; break; }
      }
      createEnemy(world, e.type, x, y, e.roomId, { spawnTime: 0.5 });
    }
  }
};

/** Sorteia o modificador de um elite (determinístico via world.rng). Estojo não recebe blindado: já tem o próprio escudo. */
export function rollAffix(world, def) {
  const names = Object.keys(AFFIXES).filter((k) => !(k === 'blindado' && def.behavior === 'fan_shooter'));
  return world.rng.pick(names);
}
