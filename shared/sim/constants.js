// Constantes compartilhadas entre cliente (navegador) e servidor (Node).
export const TILE = 32;            // tamanho do tile em pixels
export const CELL = 30;            // tamanho (em tiles) de cada célula da grade de salas
export const GRID_W = 5;           // células na horizontal
export const GRID_H = 5;           // células na vertical
export const CORRIDOR_HALF = 1;    // corredor com 3 tiles de largura (centro ± 1)

// PROP = caixa/barril destrutível (sólido até quebrar)
export const T = Object.freeze({ VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, OBSTACLE: 4, PROP: 5 });

export const TICK = 1 / 60;        // passo fixo da simulação

export const PLAYER_RADIUS = 10;
export const INTERACT_RADIUS = 40;
export const DEFAULT_AIM_DIST = 220;  // distância da mira quando não há mouse (controle, 2º teclado)
export const MAX_AIM_DIST = 1200;
export const PICKUP_MAGNET_RADIUS = 90;
export const INVULN_TIME = 0.8;
export const SHIELD_REGEN_DELAY = 5;
export const SHIELD_REGEN_INTERVAL = 0.8;
export const REVIVE_TIME = 5;        // colega parado e sem atirar por 5 s levanta quem caiu
export const REVIVE_RADIUS = 48;
export const SPAWN_TIME = 0.9;      // tempo do "portal de invocação" dos inimigos

// Temas visuais das salas (o índice é usado pelo renderizador de tiles)
export const THEMES = ['sala_aula', 'laboratorio', 'quadra', 'biblioteca', 'patio', 'secretaria', 'corredor', 'orientacao', 'coordenacao', 'cantina'];
export const THEME_INDEX = Object.fromEntries(THEMES.map((t, i) => [t, i]));

export const ROOM_LABELS = {
  start: 'Entrada',
  combat: 'Sala',
  chest: 'Sala do Baú',
  heal: 'Enfermaria',
  shop: 'Cantina (Loja)',
  statue: 'Sala da Estátua',
  boss: 'Sala do Chefe'
};

export const THEME_LABELS = {
  sala_aula: 'Sala de Aula',
  laboratorio: 'Laboratório',
  quadra: 'Quadra',
  biblioteca: 'Biblioteca',
  patio: 'Pátio',
  secretaria: 'Secretaria',
  corredor: 'Corredor',
  orientacao: 'Sala da Orientação',
  coordenacao: 'Sala da Coordenação',
  cantina: 'Cantina'
};

// Armadilha de espinhos (tachinhas gigantes): ciclo em segundos
export const TRAP_PERIOD = 3;
export const TRAP_WARN_AT = 1.7;   // começa a avisar
export const TRAP_UP_AT = 2.1;     // espinhos para cima até o fim do ciclo
