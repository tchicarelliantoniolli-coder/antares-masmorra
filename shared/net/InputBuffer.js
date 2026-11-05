/**
 * Guarda o último input de cada jogador. Botões de "toque" (habilidade, E, Q) ficam travados
 * até a simulação consumir, para nenhum toque se perder entre dois passos.
 * Usado pela sessão local (navegador) e pelas salas online (servidor).
 */
const EDGE_KEYS = ['skill', 'interact', 'swap'];

export class InputBuffer {
  constructor() { this.inputs = {}; this.seq = {}; }

  set(id, inp, seq) {
    const prev = this.inputs[id] || {};
    const next = sanitizeInput(inp);
    for (const k of EDGE_KEYS) next[k] = !!(next[k] || prev[k]);
    this.inputs[id] = next;
    if (seq !== undefined) this.seq[id] = seq;
  }

  /** Depois de cada passo da simulação: solta os botões de toque. */
  consumed() {
    for (const id in this.inputs) for (const k of EDGE_KEYS) this.inputs[id][k] = false;
  }

  remove(id) { delete this.inputs[id]; delete this.seq[id]; }
}

/** Limpa o input vindo da rede (nunca confie no cliente). */
export function sanitizeInput(inp = {}) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  let mx = Math.max(-1, Math.min(1, num(inp.moveX)));
  let my = Math.max(-1, Math.min(1, num(inp.moveY)));
  return {
    moveX: mx, moveY: my,
    aim: num(inp.aim),
    fire: !!inp.fire, skill: !!inp.skill, interact: !!inp.interact, swap: !!inp.swap
  };
}
