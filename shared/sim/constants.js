// Constantes compartilhadas entre cliente (navegador) e servidor (Node).
export const TILE = 32;            // tamanho do tile em pixels
export const CELL = 28;            // tamanho (em tiles) de cada célula da grade de salas
export const GRID_W = 5;           // células na horizontal
export const GRID_H = 5;           // células na vertical
export const CORRIDOR_HALF = 1;    // corredor com 3 tiles de largura (centro ± 1)

export const T = Object.freeze({ VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, OBSTACLE: 4 });

export const TICK = 1 / 60;        // passo fixo da simulação

export const PLAYER_RADIUS = 10;
export const INTERACT_RADIUS = 40;
export const PICKUP_MAGNET_RADIUS = 90;
export const INVULN_TIME = 0.8;
export const SHIELD_REGEN_DELAY = 4;
export const SHIELD_REGEN_INTERVAL = 0.8;
export const REVIVE_TIME = 3;
export const REVIVE_RADIUS = 48;
export const SPAWN_TIME = 0.9;      // tempo do "portal de invocação" dos inimigos

// Temas visuais das salas (o índice é usado pelo renderizador de tiles)
export const THEMES = ['sala_aula', 'laboratorio', 'quadra', 'biblioteca', 'patio', 'secretaria', 'corredor'];
export const THEME_INDEX = Object.fromEntries(THEMES.map((t, i) => [t, i]));

export const ROOM_LABELS = {
  start: 'Entrada',
  combat: 'Sala',
  chest: 'Sala do Baú',
  heal: 'Enfermaria',
  boss: 'Sala do Chefe'
};

export const THEME_LABELS = {
  sala_aula: 'Sala de Aula',
  laboratorio: 'Laboratório',
  quadra: 'Quadra',
  biblioteca: 'Biblioteca',
  patio: 'Pátio',
  secretaria: 'Secretaria',
  corredor: 'Corredor'
};
