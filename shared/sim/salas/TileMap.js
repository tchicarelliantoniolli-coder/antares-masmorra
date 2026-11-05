import { TILE, T } from '../constants.js';

/**
 * Grade de tiles do andar + colisão.
 * - tiles: tipo de cada tile (T.VOID, T.FLOOR, T.WALL, T.DOOR, T.OBSTACLE)
 * - owner: id da sala dona do tile (-1 = corredor)
 * - theme: índice do tema visual
 * Portas (T.DOOR) só bloqueiam quando a sala dona está trancada.
 */
export class TileMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h);
    this.owner = new Int16Array(w * h).fill(-1);
    this.theme = new Uint8Array(w * h);
    this.locked = new Set();
    this.props = new Map();   // índice do tile -> { kind: 'caixa' | 'barril', hp, maxHp }
    this.traps = [];          // { tx, ty, phase } espinhos
    this.decor = [];          // { kind, tx, ty } decoração sem colisão
  }

  /** Versão compacta para enviar pela rede (modo online). */
  serialize() {
    return {
      w: this.w, h: this.h,
      tiles: Array.from(this.tiles),
      owner: Array.from(this.owner),
      theme: Array.from(this.theme),
      props: [...this.props].map(([i, p]) => [i, p.kind, p.hp, p.maxHp]),
      traps: this.traps,
      decor: this.decor
    };
  }

  static deserialize(o) {
    const m = new TileMap(o.w, o.h);
    m.tiles.set(o.tiles);
    m.owner.set(o.owner);
    m.theme.set(o.theme);
    for (const [i, kind, hp, maxHp] of o.props) m.props.set(i, { kind, hp, maxHp });
    m.traps = o.traps;
    m.decor = o.decor;
    return m;
  }

  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  idx(tx, ty) { return ty * this.w + tx; }

  get(tx, ty) {
    if (!this.inBounds(tx, ty)) return T.VOID;
    return this.tiles[ty * this.w + tx];
  }

  set(tx, ty, type, owner = undefined, theme = undefined) {
    if (!this.inBounds(tx, ty)) return;
    const i = ty * this.w + tx;
    this.tiles[i] = type;
    if (owner !== undefined) this.owner[i] = owner;
    if (theme !== undefined) this.theme[i] = theme;
  }

  isSolidTile(tx, ty) {
    if (!this.inBounds(tx, ty)) return true;
    const i = ty * this.w + tx;
    const t = this.tiles[i];
    if (t === T.FLOOR) return false;
    if (t === T.DOOR) return this.locked.has(this.owner[i]);
    return true;
  }

  solidAt(px, py) {
    return this.isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  /** true se algum tile sólido encosta no retângulo (em pixels). */
  boxSolid(x0, y0, x1, y1) {
    const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE);
    const tx1 = Math.floor((x1 - 0.001) / TILE), ty1 = Math.floor((y1 - 0.001) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (this.isSolidTile(tx, ty)) return true;
      }
    }
    return false;
  }

  /**
   * Move uma entidade (caixa de meio-lado e.r) eixo por eixo, parando nas paredes.
   * Retorna { hitX, hitY }.
   */
  moveBox(e, dx, dy) {
    let hitX = false, hitY = false;
    const r = e.r;
    if (dx !== 0) {
      const nx = e.x + dx;
      if (!this.boxSolid(nx - r, e.y - r, nx + r, e.y + r)) {
        e.x = nx;
      } else {
        hitX = true;
        // encosta na parede
        let sx;
        if (dx > 0) sx = Math.floor((nx + r) / TILE) * TILE - r - 0.01;
        else sx = (Math.floor((nx - r) / TILE) + 1) * TILE + r + 0.01;
        if ((dx > 0 ? sx >= e.x : sx <= e.x) && !this.boxSolid(sx - r, e.y - r, sx + r, e.y + r)) e.x = sx;
      }
    }
    if (dy !== 0) {
      const ny = e.y + dy;
      if (!this.boxSolid(e.x - r, ny - r, e.x + r, ny + r)) {
        e.y = ny;
      } else {
        hitY = true;
        let sy;
        if (dy > 0) sy = Math.floor((ny + r) / TILE) * TILE - r - 0.01;
        else sy = (Math.floor((ny - r) / TILE) + 1) * TILE + r + 0.01;
        if ((dy > 0 ? sy >= e.y : sy <= e.y) && !this.boxSolid(e.x - r, sy - r, e.x + r, sy + r)) e.y = sy;
      }
    }
    return { hitX, hitY };
  }

  /** Anda em linha reta a partir de (x, y) até achar sólido ou maxDist. Devolve o último ponto livre. */
  raycast(x, y, angle, maxDist, step = 4) {
    const cx = Math.cos(angle), cy = Math.sin(angle);
    let d = 0;
    while (d + step <= maxDist && !this.solidAt(x + cx * (d + step), y + cy * (d + step))) d += step;
    return { x: x + cx * d, y: y + cy * d, dist: d };
  }

  /** Linha de visão simples (amostragem a cada meio tile). */
  lineOfSight(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / (TILE / 2));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }
}
