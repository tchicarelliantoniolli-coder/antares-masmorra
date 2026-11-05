// Registro dos dados do jogo (armas, personagens, inimigos) carregados dos arquivos JSON.
// O navegador busca os JSON com fetch; o Node lê do disco (veja loadDataNode.js).

const PROJECTILE_DEFAULTS = {
  speed: 450, radius: 5, range: 500, count: 1, spread: 0, pierce: 0, bounce: 0,
  homing: 0, boomerang: false, spin: 0, explode: null, explodeOnExpire: false,
  glyphs: null, glyphBonus: null, ghost: false,
  sprite: { shape: 'orb', color: '#ffffff', accent: '#cccccc' }
};
const MELEE_DEFAULTS = { range: 50, arc: 110, knockback: 150, deflect: false, reflect: false };

const REQUIRED_WEAPON_FIELDS = ['id', 'name', 'category', 'rarity', 'type', 'damage', 'fireRate', 'energyCost', 'critChance', 'inaccuracy'];
const WEAPON_TYPES = ['ranged', 'melee'];
const EFFECT_TYPES = ['fogo', 'gelo', 'veneno', 'choque', 'atordoar'];

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
  }
  return errors;
}

export function normalizeWeapon(w) {
  const out = { ...w };
  out.effect = w.effect ? { chance: 1, duration: 3, power: 1, ...w.effect } : null;
  if (w.type === 'melee') {
    out.melee = { ...MELEE_DEFAULTS, ...(w.melee || {}) };
  } else {
    const p = { ...PROJECTILE_DEFAULTS, ...(w.projectile || {}) };
    p.sprite = { ...PROJECTILE_DEFAULTS.sprite, ...(w.projectile?.sprite || {}) };
    out.projectile = p;
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
