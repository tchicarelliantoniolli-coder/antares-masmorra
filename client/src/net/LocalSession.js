import { World } from '/shared/sim/World.js';
import { TICK } from '/shared/sim/constants.js';

const EDGE_KEYS = ['skill', 'interact', 'swap'];

/**
 * Sessão local (modo solo e, na Etapa 3, co-op local): a simulação roda aqui no navegador.
 * A sessão online (Etapa 2) terá a mesma interface, mas recebendo o estado do servidor via Socket.io.
 */
export class LocalSession {
  constructor(data, players, opts = {}) {
    this.world = new World({ data, players, ...opts });
    this.acc = 0;
    this.inputs = {};
    this.localPlayerIds = players.map((p) => p.id);
  }

  /** Guarda o input; botões de "toque" (habilidade, E, Q) ficam travados até a simulação consumir. */
  setInput(id, inp) {
    const prev = this.inputs[id] || {};
    const next = { ...inp };
    for (const k of EDGE_KEYS) next[k] = !!(inp[k] || prev[k]);
    this.inputs[id] = next;
  }

  update(deltaMs) {
    this.acc += Math.min(deltaMs / 1000, 0.1);
    let steps = 0;
    while (this.acc >= TICK && steps < 6) {
      this.world.step(TICK, this.inputs);
      for (const id in this.inputs) for (const k of EDGE_KEYS) this.inputs[id][k] = false;
      this.acc -= TICK;
      steps++;
    }
  }

  drainEvents() {
    return this.world.drainEvents();
  }
}
