import { T } from '../constants.js';
import { LAYOUT_NAMES } from './kinds.js';

/**
 * Plantas (layouts) das salas: onde ficam paredes, carteiras, estantes etc. dentro da sala.
 *
 *  - Salas de combate: `applyLayout(nome, r, put, rng)` desenha o layout; quem decide se ele ficou bom
 *    (portas alcançáveis, chão suficiente) é o DungeonGenerator, que tenta outro se não ficar.
 *  - Salas especiais (início, baú, enfermaria, estátua, cantina, chefe): `furnishSpecial` monta a composição
 *    própria de cada uma, sempre sem tocar nas portas, no centro nem nos lugares dos itens.
 *
 * Coordenadas dos layouts: (dx, dy) relativas ao centro da sala (cx, cy); dx cresce para a direita, dy para baixo.
 * Nada aqui usa Phaser nem Math.random: todo sorteio vem do `rng` da partida (mesma semente = mesma sala).
 */

const CORNERS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

/** Os 8 layouts geométricos (já existiam antes dos temáticos). */
export const GEOMETRIC_LAYOUTS = ['pilares', 'pilares6', 'cantos', 'trincheiras', 'centro', 'xadrez', 'colunas', 'aberto'];
/** Todos os layouts de combate disponíveis (nomes oficiais em kinds.js). */
export const COMBAT_LAYOUTS = [...LAYOUT_NAMES];

/** Tiles "reservados": a boca de cada porta (5 de largura x 3 de fundo), para ninguém ficar preso ao entrar. */
export function reservedSet(r) {
  const res = new Set();
  for (const d of r.doors) {
    for (let k = 1; k <= 3; k++) {
      for (let o = -2; o <= 2; o++) {
        let x, y;
        if (d.dir === 'E') { x = d.tx - k; y = d.ty + o; }
        else if (d.dir === 'W') { x = d.tx + k; y = d.ty + o; }
        else if (d.dir === 'S') { x = d.tx + o; y = d.ty - k; }
        else { x = d.tx + o; y = d.ty + k; }
        res.add(x + ',' + y);
      }
    }
  }
  return res;
}

/**
 * Ordem em que os layouts de combate serão tentados: primeiro os do tema (sorteio ponderado sem repetir),
 * depois os geométricos que sobrarem e, por último, os temáticos dos outros cenários.
 * `pesos` = themes[tema].combatLayouts ({ nome: peso }).
 */
export function layoutOrder(rng, pesos) {
  const ordem = [];
  const restante = {};
  for (const [nome, peso] of Object.entries(pesos || {})) {
    if (COMBAT_LAYOUTS.includes(nome) && peso > 0) restante[nome] = peso;
  }
  while (Object.keys(restante).length) {
    const nome = rng.weighted(restante);
    ordem.push(nome);
    delete restante[nome];
  }
  const geometricos = rng.shuffle(GEOMETRIC_LAYOUTS.filter((n) => !ordem.includes(n)));
  const outros = rng.shuffle(COMBAT_LAYOUTS.filter((n) => !ordem.includes(n) && !geometricos.includes(n)));
  return [...ordem, ...geometricos, ...outros];
}

/**
 * Pôr um bloco sólido em (x, y) criaria uma "pinça": dois blocos que só se tocam pela quina, com chão nos outros
 * dois cantos de um quadrado 2x2? Inimigos andam em linha reta e travam eixo por eixo, então ficam presos nessas
 * quinas olhando para um alvo que está na diagonal (e o jogador não passa pela fresta). Os layouts evitam.
 */
export function formariaPinca(map, x, y) {
  const solido = (a, b) => {
    if (a === x && b === y) return true;
    const t = map.get(a, b);
    return t !== T.FLOOR && t !== T.DOOR;
  };
  for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const ax = x + ox, ay = y + oy;
    const A = solido(ax, ay), B = solido(ax + 1, ay), C = solido(ax, ay + 1), D = solido(ax + 1, ay + 1);
    if ((A && D && !B && !C) || (B && C && !A && !D)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ contexto de desenho

function makeCtx(r, put, rng) {
  const hw = Math.floor((r.w - 2) / 2), hh = Math.floor((r.h - 2) / 2);
  const c = {
    r, rng, hw, hh,
    a: Math.max(3, Math.floor(hw / 2)), b: Math.max(3, Math.floor(hh / 2)),
    /** Um tile (padrão: obstáculo mobiliário). */
    at: (dx, dy, type = T.OBSTACLE) => put(r.cx + dx, r.cy + dy, type),
    /** Retângulo [dx0..dx1] x [dy0..dy1] (extremos em qualquer ordem). */
    box: (dx0, dy0, dx1, dy1, type = T.OBSTACLE) => {
      for (let dy = Math.min(dy0, dy1); dy <= Math.max(dy0, dy1); dy++) {
        for (let dx = Math.min(dx0, dx1); dx <= Math.max(dx0, dx1); dx++) c.at(dx, dy, type);
      }
    },
    each4: (fn) => { for (const [sx, sy] of CORNERS) fn(sx, sy); },
    /** Retângulo do quadrante (+x, +y) espelhado nos 4 quadrantes. */
    quad: (dx0, dy0, dx1, dy1, type = T.OBSTACLE) => c.each4((sx, sy) => c.box(sx * dx0, sy * dy0, sx * dx1, sy * dy1, type)),
    /** Mesmo bloco de pontos nos 4 quadrantes (parede por padrão, como nos layouts geométricos). */
    sym4: (offsets, type = T.WALL) => {
      for (const [dx, dy] of offsets) c.each4((sx, sy) => c.at(dx * sx, dy * sy, type));
    }
  };
  return c;
}

// ------------------------------------------------------------------ layouts geométricos (paredes)

const LAYOUTS = {
  aberto() {},

  pilares(c) {
    c.sym4([[c.a, c.b], [c.a + 1, c.b], [c.a, c.b + 1], [c.a + 1, c.b + 1]]);
  },

  pilares6(c) {
    c.sym4([[c.a + 1, c.b], [c.a + 1, c.b + 1]]);
    for (const sy of [1, -1]) { c.at(0, sy * c.b, T.WALL); c.at(0, sy * (c.b + 1), T.WALL); }
  },

  cantos(c) {
    c.sym4([[c.a, c.b], [c.a + 1, c.b], [c.a + 2, c.b], [c.a, c.b - 1], [c.a, c.b - 2]]);
  },

  trincheiras(c) {
    for (let dx = 2; dx <= Math.min(c.a + 2, c.hw - 2); dx++) c.sym4([[dx, c.b]]);
  },

  centro(c) {
    c.box(-1, -1, 1, 1, T.WALL);
    c.sym4([[c.a + 1, c.b + 1]]);
  },

  xadrez(c) {
    for (let dx = 3; dx < c.hw - 1; dx += 4) for (let dy = 2; dy < c.hh - 1; dy += 4) c.sym4([[dx, dy]]);
  },

  colunas(c) {
    for (let dy = 1; dy <= Math.min(3, c.hh - 3); dy++) c.sym4([[c.a, dy]]);
    c.sym4([[c.a, 0]]);
  },

  // ---------------------------------------------------------------- layouts temáticos (móveis = obstáculos)

  /** Sala de aula: fileiras de carteiras (duplas) com um corredor central e corredores entre as fileiras. */
  carteiras(c) {
    const { rng, hw, hh } = c;
    c.each4((sx, sy) => {
      for (const dy of [3, 6]) {
        if (dy > hh - 1) continue;
        for (const dx of [3, 6]) {
          if (dx + 1 > hw - 1) continue;
          if (!rng.chance(0.93)) continue;                // uma carteira vazia de vez em quando
          c.box(sx * dx, sy * dy, sx * (dx + 1), sy * dy);
        }
      }
    });
  },

  /** Carteiras em U em volta do centro (aula em círculo), aberto para um dos 4 lados. */
  carteiras_u(c) {
    const aberto = c.rng.pick(['S', 'N', 'E', 'W']);
    const L = aberto === 'S' || aberto === 'N' ? 4 : 3;
    // forma base aberta para baixo (+y): base em y=-3 e braços em x=±L descendo até y=+1
    const pontos = [];
    for (let x = -L; x <= L; x++) pontos.push([x, -3]);
    for (let y = -2; y <= 1; y++) { pontos.push([-L, y]); pontos.push([L, y]); }
    for (const [x, y] of pontos) {
      if (aberto === 'S') c.at(x, y);
      else if (aberto === 'N') c.at(x, -y);
      else if (aberto === 'E') c.at(y, x);
      else c.at(-y, x);
    }
  },

  /** Laboratório: bancadas em ilhas de 3-4 tiles (formatos variados), uma ou duas por quadrante. */
  bancadas(c) {
    const { rng, hw, hh } = c;
    const formas = [
      [[0, 0], [1, 0], [2, 0], [3, 0]],   // bancada reta de 4
      [[0, 0], [1, 0], [2, 0]],           // 3 em linha
      [[0, 0], [0, 1], [0, 2]],           // 3 em pé
      [[0, 0], [1, 0], [0, 1], [1, 1]],   // quadrado
      [[0, 0], [1, 0], [2, 0], [0, 1]]    // L
    ];
    const ancoras = [[3, 3]];
    if (hh >= 8) ancoras.push([3, 6]);
    c.each4((sx, sy) => {
      for (const [ax, ay] of ancoras) {
        const forma = rng.pick(formas);
        const jx = rng.chance(0.5) ? 1 : 0;
        for (const [px, py] of forma) c.at(sx * (ax + jx + px), sy * (ay + py));
      }
    });
  },

  /** Quatro ilhas grandes (3x2 ou 4x2), uma em cada quadrante. */
  ilhas(c) {
    const largura = c.hw >= 10 ? 4 : 3;
    c.quad(4, 3, 4 + largura - 1, 4);
  },

  /** Biblioteca: corredores de estantes (pilhas de 2 tiles) com passagens, deixando o eixo central livre. */
  estantes(c) {
    const { rng, hw, hh } = c;
    c.each4((sx, sy) => {
      for (const x0 of [3, 7]) {
        if (x0 > hw - 1) continue;
        const fim = hh - 2;                                            // deixa uma faixa livre junto às paredes de cima e de baixo
        const falha = fim - 2 + 1 >= 4 ? rng.int(3, fim - 1) : -1;   // segmentos longos ganham uma passagem
        for (let y = 2; y <= fim; y++) {
          if (y === falha || y === falha + 1) continue;
          c.at(sx * x0, sy * y);
          c.at(sx * (x0 + 1), sy * y);
        }
      }
    });
  },

  /** Quadra: meio livre; traves (postes) nas duas pontas, em volta das portas, e bancos de reservas nas laterais. */
  quadra(c) {
    const { hw, hh } = c;
    c.quad(hw - 1, 3, hw - 1, 4);                       // postes das traves (oeste e leste)
    c.each4((sx, sy) => {                                 // bancos junto às paredes de cima e de baixo
      c.box(sx * (hw - 4), sy * (hh - 1), sx * (hw - 2), sy * (hh - 1));
    });
  },

  /** Pátio: canteiros em anel em volta do centro, com 4 aberturas nos eixos, mais vasos nos cantos. */
  canteiros(c) {
    const { rng, hw, hh } = c;
    const R = hh >= 7 ? 4 : 3;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === R && Math.min(Math.abs(dx), Math.abs(dy)) >= 2) c.at(dx, dy);
      }
    }
    c.each4((sx, sy) => { if (rng.chance(0.7)) c.at(sx * (hw - 1), sy * (hh - 1)); });
  },

  /** Secretaria/cantina: 2 ou 3 mesas longas (horizontais ou verticais), com o meio livre. */
  mesas_longas(c) {
    const { rng, hw, hh } = c;
    const grossura = rng.int(1, 2);
    const variante = rng.pick(['h2', 'h2', 'h3', 'v2']);
    if (variante === 'v2') {
      const L = hh - 4 - rng.int(0, 1);
      for (const sx of [1, -1]) c.box(sx * 4, -L, sx * (4 + grossura - 1), L);
    } else {
      const L = hw - 4 - rng.int(0, 1);
      if (variante === 'h2') {
        for (const sy of [1, -1]) c.box(-L, sy * 3, L, sy * (3 + grossura - 1));
      } else {
        for (const sy of [1, -1]) c.box(-L, sy * 4, L, sy * 4);
        for (const sx of [1, -1]) c.box(sx * 3, 0, sx * L, 0);   // mesa do meio, com o centro livre
      }
    }
  },

  /** Biblioteca: uma divisória central (parede) com passagens, separando a sala em duas metades. */
  sala_dupla(c) {
    const { rng, hw, hh } = c;
    if (rng.chance(0.5)) {
      for (let dy = -(hh - 3); dy <= hh - 3; dy++) if (Math.abs(dy) > 1) c.at(0, dy, T.WALL);
    } else {
      for (let dx = -(hw - 3); dx <= hw - 3; dx++) if (Math.abs(dx) > 1) c.at(dx, 0, T.WALL);
    }
  }
};

/** Desenha o layout `nome` na sala de combate `r` usando `put(x, y, tipo)` (que recusa tiles ocupados/reservados). */
export function applyLayout(nome, r, put, rng) {
  const fn = LAYOUTS[nome];
  if (fn) fn(makeCtx(r, put, rng));
}

// ------------------------------------------------------------------ salas especiais

/**
 * Composição própria de cada sala especial (todas retangulares nesta versão).
 * Nada é colocado na boca das portas, no centro (onde ficam baú, estátua, enfermaria e portal) nem
 * na faixa onde a loja expõe os itens.
 */
export function furnishSpecial(rng, map, r, floorDef) {
  const hw = Math.floor((r.w - 2) / 2), hh = Math.floor((r.h - 2) / 2);
  const reservado = reservedSet(r);
  const put = (dx, dy, tipo = T.OBSTACLE) => {
    const x = r.cx + dx, y = r.cy + dy;
    if (x <= r.x0 || x >= r.x0 + r.w - 1 || y <= r.y0 || y >= r.y0 + r.h - 1) return false;
    if (map.get(x, y) !== T.FLOOR || reservado.has(x + ',' + y) || formariaPinca(map, x, y)) return false;
    map.set(x, y, tipo);
    return true;
  };
  const box = (dx0, dy0, dx1, dy1, tipo) => {
    for (let dy = Math.min(dy0, dy1); dy <= Math.max(dy0, dy1); dy++) {
      for (let dx = Math.min(dx0, dx1); dx <= Math.max(dx0, dx1); dx++) put(dx, dy, tipo);
    }
  };
  const cantos = (fn) => { for (const [sx, sy] of CORNERS) fn(sx, sy); };

  switch (r.type) {
    case 'start':
      // armários/bancos nos 4 cantos, em L (o meio e as laterais das portas ficam livres)
      cantos((sx, sy) => {
        box(sx * (hw - 1), sy * hh, sx * hw, sy * hh);
        box(sx * hw, sy * (hh - 2), sx * hw, sy * (hh - 1));
      });
      break;
    case 'chest':
      // quatro colunas baixas em volta do baú (a 2 tiles) e os pilares de sempre mais ao fundo
      cantos((sx, sy) => {
        put(sx * 2, sy * 2);
        put(sx * 4, sy * 3, T.WALL);
      });
      break;
    case 'heal':
      // macas encostadas nas paredes: 3 tiles em cima/embaixo e 2 nas laterais, em cada canto (o meio e as portas ficam livres)
      cantos((sx, sy) => {
        box(sx * 4, sy * hh, sx * hw, sy * hh);
        box(sx * hw, sy * (hh - 1), sx * hw, sy * (hh - 2));
      });
      break;
    case 'statue':
      // pedestais em anel em volta da estátua; o centro fica livre (os pedestais ficam a 3 tiles dele)
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2], [2, -2], [-2, -2]]) put(dx, dy);
      break;
    case 'shop':
      // estantes de mercadorias nas laterais (a faixa dos itens e as portas ficam livres)
      cantos((sx, sy) => box(sx * hw, sy * (hh - 1), sx * hw, sy * hh));
      break;
    case 'boss':
      // arena livre: só os pilares do andar (floors[n].bossPillars). Bancos junto às paredes foram testados e
      // encurralam o jogador nos cantos (a taxa de vitória contra a Samara caiu de 75% para 12-40% com o bot).
      if (floorDef?.bossPillars) {
        const a = 7, b = 5;
        cantos((sx, sy) => {
          for (const [dx, dy] of [[a, b], [a + 1, b], [a, b + 1], [a + 1, b + 1]]) put(sx * dx, sy * dy, T.WALL);
        });
      }
      break;
    default:
      break;
  }
}
