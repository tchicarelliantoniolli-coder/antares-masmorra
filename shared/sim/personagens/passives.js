/**
 * Passivos: modificam os atributos do jogador quando ele é criado.
 * (Os que dependem de sistemas da Etapa 3 — aliados, poças de tinta, etc. — ainda não fazem efeito.)
 */
export const PASSIVES = {
  caneta_vermelha: (p) => { p.mods.critBonus += 0.15; },             // Ana Cláudia
  calculo_mental: (p) => { p.mods.energyCostMul *= 0.75; },          // Harilson
  condicionamento: (p) => { p.maxHp += 3; p.hp += 3; },              // Filipe
  memoria_historica: (p) => { p.maxShield += 1; p.shield += 1; },    // Gabriela S.
  metabolismo: (p) => { p.mods.regen = 20; },                        // Vivian: 1 de vida a cada 20 s
  leitura_dinamica: (p) => { p.mods.skillCdMul *= 0.8; },            // Tatiane
  inercia: (p) => { p.mods.knockback += 120; }                       // Jean Paulo
};

export function applyPassive(p, id) {
  if (id && PASSIVES[id]) PASSIVES[id](p);
}
