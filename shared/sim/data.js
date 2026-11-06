// Registro dos dados do jogo (armas, personagens, inimigos) carregados dos arquivos JSON.
// O navegador busca os JSON com fetch; o Node lê do disco (veja loadDataNode.js).

const PROJECTILE_DEFAULTS = {
  speed: 450, radius: 5, range: 500, count: 1, spread: 0, pierce: 0, bounce: 0,
  homing: 0, boomerang: false, spin: 0, explode: null, explodeOnExpire: false,
  glyphs: null, glyphBonus: null, ghost: false,
  pool: null, glyphSplit: null, growOnReturn: 1, knockback: 0,
  sharedHit: false, // projéteis do mesmo disparo acertam cada inimigo uma vez só (anel)
  sprite: { shape: 'orb', color: '#ffffff', accent: '#cccccc' }
};
const MELEE_DEFAULTS = { range: 50, arc: 110, knockback: 150, deflect: false, reflect: false };

export const WEAPON_MODES = ['shot', 'burst', 'charge', 'spinup', 'beam', 'flame', 'lob', 'split', 'chain', 'deploy', 'singularity', 'rain', 'orbit', 'variants'];
export const MELEE_STYLES = ['swing', 'thrust', 'combo', 'shield'];
export const DEPLOY_KINDS = ['mine', 'turret'];

/** Nomes dos modos e estilos em português (card da arma). */
export const MODE_LABELS = {
  shot: 'Tiro', burst: 'Rajada', charge: 'Carregar', spinup: 'Aquecimento', beam: 'Laser contínuo', flame: 'Lança-chamas',
  lob: 'Arremesso em arco', split: 'Tiro que se divide', chain: 'Raio em cadeia', deploy: 'Coloca no chão',
  singularity: 'Buraco negro', rain: 'Chuva', orbit: 'Órbita', variants: 'Sorteio',
  swing: 'Golpe', thrust: 'Estocada', combo: 'Combo', shield: 'Escudo'
};

/** Padrões de cada modo (o bloco com o mesmo nome no JSON é mesclado por cima). */
export const MODE_DEFAULTS = {
  shot: {},
  burst: { count: 3, interval: 0.07 },
  charge: { time: 1.0, minMul: 0.4, maxMul: 2.5, fullPierce: 0, fullCount: 1, fullBounce: 0 },
  spinup: { startMul: 0.35, maxMul: 1.6, rampTime: 1.4 },
  beam: { dps: 20, tick: 0.1, range: 420, width: 6, pierce: false, ghost: false, energyPerSec: 6 },
  flame: { range: 130, arc: 40, particles: 2 },
  lob: { maxRange: 360, flightTime: 0.6, peak: 50, fuse: 0, bounces: 0, pool: null },
  split: { into: 3, childDamageMul: 0.5, spread: 60 },
  chain: { range: 300, chains: 3, radius: 130, falloff: 0.8, aimCone: 35 },
  deploy: { kind: 'mine', max: 3, life: 12, radius: 60, damage: 12, fireRate: 2, range: 220, triggerRadius: 28 },
  singularity: { pullRadius: 110, life: 2.5, dps: 8, pull: 170 },
  rain: { count: 5, radius: 70, delay: 0.5, hitRadius: 26, maxRange: 380 },
  orbit: { max: 4, radius: 34, spin: 4, launchSpeed: 480 },
  variants: { list: [] }
};
/** Padrões dos estilos de corpo a corpo (ficam dentro do bloco "melee", ex.: melee.combo). */
export const STYLE_DEFAULTS = {
  swing: {},
  thrust: { distance: 110, time: 0.16 },
  combo: { steps: 3, finisherMul: 2, finisherArcBonus: 40, resetTime: 0.7 },
  shield: { arc: 110, blockCost: 1, speedMul: 0.6, bashKnockback: 320 }
};
/** Poça no chão (lob.pool, projectile.pool). */
export const POOL_DEFAULTS = { r: 40, life: 3, dps: 2, effect: null, slowMul: 1, style: 'paint' };

const REQUIRED_WEAPON_FIELDS = ['id', 'name', 'category', 'rarity', 'type', 'damage', 'fireRate', 'energyCost', 'critChance', 'inaccuracy'];
const WEAPON_TYPES = ['ranged', 'melee'];
const EFFECT_TYPES = ['fogo', 'gelo', 'veneno', 'choque', 'atordoar'];

function unknownKeys(tag, block, defaults, where, errors) {
  if (!block || typeof block !== 'object') return;
  for (const k of Object.keys(block)) {
    if (!(k in defaults)) errors.push(`${tag}: campo desconhecido "${k}" em ${where}`);
  }
}

/** Valida o JSON de armas e devolve uma lista de erros (vazia = tudo certo). */
export function validateWeapons(json) {
  const errors = [];
  if (!json || !Array.isArray(json.weapons)) return ['"weapons" precisa ser uma lista'];
  const ids = new Set();
  for (const w of json.weapons) {
    const tag = w.id || '(sem id)';
    for (const f of REQUIRED_WEAPON_FIELDS) {
      if (w[f] === undefined) errors.push(`${tag}: campo obrigatório "${f}" faltando`);
    }
    if (ids.has(w.id)) errors.push(`${tag}: id repetido`);
    ids.add(w.id);
    if (w.rarity && !json.rarities?.[w.rarity]) errors.push(`${tag}: raridade desconhecida "${w.rarity}"`);
    if (w.category && !json.categories?.[w.category]) errors.push(`${tag}: categoria desconhecida "${w.category}"`);
    if (w.type && !WEAPON_TYPES.includes(w.type)) errors.push(`${tag}: type deve ser ranged ou melee`);
    if (w.effect && !EFFECT_TYPES.includes(w.effect.type)) errors.push(`${tag}: efeito desconhecido "${w.effect.type}"`);
    for (const f of ['damage', 'fireRate', 'energyCost', 'critChance', 'inaccuracy']) {
      if (w[f] !== undefined && (typeof w[f] !== 'number' || w[f] < 0)) errors.push(`${tag}: "${f}" deve ser um número >= 0`);
    }
    if (w.fireRate === 0) errors.push(`${tag}: fireRate não pode ser 0`);
    if (w.type === 'ranged') {
      const mode = w.mode ?? 'shot';
      if (!WEAPON_MODES.includes(mode)) errors.push(`${tag}: modo desconhecido "${mode}"`);
      else {
        unknownKeys(tag, w[mode], MODE_DEFAULTS[mode], mode, errors);
        if (mode === 'variants' && !(Array.isArray(w.variants?.list) && w.variants.list.length)) errors.push(`${tag}: variants precisa de "list" com pelo menos 1 variante`);
        if (mode === 'deploy' && w.deploy?.kind !== undefined && !DEPLOY_KINDS.includes(w.deploy.kind)) errors.push(`${tag}: deploy.kind deve ser ${DEPLOY_KINDS.join(' ou ')}`);
        if (mode === 'deploy' && w.deploy?.max !== undefined && !(Number.isInteger(w.deploy.max) && w.deploy.max >= 1)) errors.push(`${tag}: deploy.max deve ser pelo menos 1`);
        if (mode === 'lob') unknownKeys(tag, w.lob?.pool, POOL_DEFAULTS, 'lob.pool', errors);
      }
      unknownKeys(tag, w.projectile?.pool, POOL_DEFAULTS, 'projectile.pool', errors);
    }
    if (w.type === 'melee') {
      const style = w.melee?.style ?? 'swing';
      if (!MELEE_STYLES.includes(style)) errors.push(`${tag}: estilo de corpo a corpo desconhecido "${style}"`);
      else unknownKeys(tag, w.melee?.[style], STYLE_DEFAULTS[style], 'melee.' + style, errors);
    }
  }
  return errors;
}

function normalizeProjectile(pr) {
  const p = { ...PROJECTILE_DEFAULTS, ...(pr || {}) };
  p.sprite = { ...PROJECTILE_DEFAULTS.sprite, ...(pr?.sprite || {}) };
  if (p.pool) p.pool = { ...POOL_DEFAULTS, ...p.pool };
  return p;
}

export function normalizeWeapon(w) {
  const out = { ...w };
  out.effect = w.effect ? { chance: 1, duration: 3, power: 1, ...w.effect } : null;
  if (w.type === 'melee') {
    const style = w.melee?.style ?? 'swing';
    out.melee = { ...MELEE_DEFAULTS, ...(w.melee || {}), style };
    out.melee[style] = { ...(STYLE_DEFAULTS[style] || {}), ...(w.melee?.[style] || {}) };
  } else {
    out.projectile = normalizeProjectile(w.projectile);
    const mode = w.mode ?? 'shot';
    out.mode = mode;
    out[mode] = { ...(MODE_DEFAULTS[mode] || {}), ...(w[mode] || {}) };
    if (mode === 'variants') {
      // cada variante é um projétil completo, herdando o projétil base da arma
      out.variants.list = (w.variants?.list || []).map((v, i) => {
        const { damageMul = 1, ...rest } = v;
        const pr = normalizeProjectile({ ...(w.projectile || {}), ...rest, sprite: { ...(w.projectile?.sprite || {}), ...(rest.sprite || {}) } });
        return { ...pr, damageMul, spriteKey: `proj_${w.id}_v${i}` };
      });
    }
    if (mode === 'lob' && out.lob.pool) out.lob.pool = { ...POOL_DEFAULTS, ...out.lob.pool };
  }
  out.sprite = { shape: 'pistol', color: '#cccccc', accent: '#444444', ...(w.sprite || {}) };
  out.starterOnly = !!w.starterOnly;
  return out;
}

export class GameData {
  constructor({ weapons, characters, enemies }) {
    const errors = validateWeapons(weapons);
    if (errors.length) throw new Error('Erros em weapons.json:\n' + errors.join('\n'));
    this.rarities = weapons.rarities;
    this.categories = weapons.categories;
    this.effects = weapons.effects || {};
    this.weapons = new Map(weapons.weapons.map((w) => [w.id, normalizeWeapon(w)]));
    this.characters = new Map(characters.characters.map((c) => [c.id, c]));
    this.characterList = characters.characters;
    this.bosses = characters.bosses || [];
    this.enemies = enemies.enemies;
    this.floors = enemies.floors;
    this.difficulty = enemies.difficulty || {};
  }
  weapon(id) {
    const w = this.weapons.get(id);
    if (!w) throw new Error(`Arma desconhecida: ${id}`);
    return w;
  }
  hasWeapon(id) { return this.weapons.has(id); }
  character(id) {
    const c = this.characters.get(id);
    if (!c) throw new Error(`Personagem desconhecido: ${id}`);
    return c;
  }
  enemy(type) {
    const e = this.enemies[type];
    if (!e) throw new Error(`Inimigo desconhecido: ${type}`);
    return e;
  }
  floor(n) {
    return this.floors.find((f) => f.floor === n) || this.floors[this.floors.length - 1];
  }
  /** Armas que podem aparecer em baús/drops (as iniciais ficam de fora). */
  droppableWeapons(rarity) {
    return [...this.weapons.values()].filter((w) => !w.starterOnly && (!rarity || w.rarity === rarity));
  }
  /** Sorteia uma arma usando os pesos de raridade; minRarity garante raridade mínima. */
  rollWeapon(rng, weights, minRarity = null) {
    const minOrder = minRarity ? this.rarities[minRarity].order : 0;
    const w = {};
    for (const [k, r] of Object.entries(this.rarities)) {
      if (r.order >= minOrder) w[k] = weights?.[k] ?? r.weight;
    }
    let rarity = rng.weighted(w);
    // Se não existir arma daquela raridade, desce até achar.
    const order = Object.entries(this.rarities).sort((a, b) => b[1].order - a[1].order).map(([k]) => k);
    let idx = order.indexOf(rarity);
    while (idx < order.length) {
      const pool = this.droppableWeapons(order[idx]);
      if (pool.length) return rng.pick(pool).id;
      idx++;
    }
    return rng.pick(this.droppableWeapons()).id;
  }
}
