export const GAME_W = 960;
export const GAME_H = 540;

export const FONT_TITLE = '"Press Start 2P", monospace';
export const FONT_BODY = '"VT323", monospace';

export const COLORS = {
  bg: 0x0d0b14,
  panel: 0x1d1a2b,
  panelLight: 0x2a2540,
  border: 0x5a4f80,
  gold: 0xffd23f,
  hp: 0xe04848,
  shield: 0x9aa7b8,
  energy: 0x3a8cff,
  text: '#f4f0ff',
  dim: '#a39cc0'
};

/** Estilo de texto padrão (fonte de pixel). */
export function textStyle(size = 20, color = COLORS.text, extra = {}) {
  return { fontFamily: FONT_BODY, fontSize: size + 'px', color, ...extra };
}

export function titleStyle(size = 16, color = '#ffd23f', extra = {}) {
  return { fontFamily: FONT_TITLE, fontSize: size + 'px', color, ...extra };
}
