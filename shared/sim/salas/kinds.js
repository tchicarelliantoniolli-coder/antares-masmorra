/**
 * Nomes fixos usados pelos cenários (themes.json). O gerador (sim) implementa LAYOUT_NAMES, SHAPE_NAMES e
 * escolhe PROP_KINDS / decorações; o cliente desenha cada nome (sprites prop_<kind> e decor_<kind>, decalques,
 * partículas). Para criar um nome novo: adicione aqui, implemente nos dois lados e use no themes.json.
 */
export const LAYOUT_NAMES = [
  // geométricos (já existiam)
  'pilares', 'pilares6', 'cantos', 'trincheiras', 'centro', 'xadrez', 'colunas', 'aberto',
  // temáticos (v0.4)
  'carteiras', 'carteiras_u', 'bancadas', 'ilhas', 'estantes', 'quadra', 'canteiros', 'mesas_longas', 'sala_dupla'
];

/** Formas das salas de combate (as portas ficam sempre no meio de cada lado e continuam alcançáveis). */
export const SHAPE_NAMES = ['retangulo', 'cantos_cortados', 'L', 'cruz', 'T'];

/** Objetos quebráveis (T.PROP): todos agem como caixa (hp 4), exceto 'barril' (explode). Sprite: prop_<kind>. */
export const PROP_KINDS = ['caixa', 'barril', 'mochila', 'pilha_livros', 'caixa_tubos', 'cesto_bolas', 'vaso', 'pilha_papeis', 'bandeja'];

/** Decoração presa na parede de cima. Largura em tiles; sprite decor_<kind> com (largura × 32) px de largura. */
export const DECOR_WIDTH = {
  lousa: 3, placar: 3, estante_parede: 3, mapa_mundi: 3,
  quadro_avisos: 2, trofeus: 2,
  cartaz: 1, relogio: 1, tabela_periodica: 1, cartaz_dna: 1, cesta: 1, quadro: 1, janela: 1, mural: 1, cardapio: 1,
  lampada: 1, bandeira: 1, extintor: 1
};
export const DECOR_KINDS = Object.keys(DECOR_WIDTH);
/** Decorações que emitem luz (o cliente acende um brilho ao redor). */
export const LIGHT_DECOR = ['lampada', 'janela'];

export const PARTICLE_KINDS = ['poeira', 'bolhas', 'folhas', 'vapor', 'papeis', 'brasas'];
export const DECAL_KINDS = ['tapete', 'giz', 'papeis', 'manchas', 'pegadas', 'derramado', 'poca', 'rachaduras',
  'marcas_quadra', 'amarelinha', 'folhas', 'migalhas'];
