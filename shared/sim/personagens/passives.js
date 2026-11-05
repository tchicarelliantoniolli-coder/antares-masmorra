/**
 * Passivos: modificam os atributos do jogador quando ele é criado.
 * (Os que dependem de sistemas da Etapa 3 — aliados, poças de tinta, etc. — ainda não fazem efeito.)
 */
export const PASSIVES = {
  caneta_vermelha: (p) => { p.mods.critBonus += 0.15; },             // Ana Cláudia
  calculo_mental: (p) => { p.mods.energyCostMul *= 0.75; },          // Harilson
  condicionamento: (p) => { p.maxHp += 3; p.hp += 3; },              // Filipe
  memoria_historica: (p) => { p.maxShield += 1; p.shield += 1; p.mods.shieldRegenMul = 0.6; }, // Gabriela S.: escudo volta mais rápido
  alta_voltagem: (p) => { p.mods.shockChance = 0.15; },             // Vinícius: 15% de choque em todo dano direto
  metabolismo: (p) => { p.mods.regen = 20; },                        // Vivian: 1 de vida a cada 20 s
  leitura_dinamica: (p) => { p.mods.skillCdMul *= 0.8; },            // Tatiane
  inercia: (p) => { p.mods.knockback += 120; },                      // Jean Paulo
  spelling_bee: (p) => { p.mods.vowelCrit = true; },                 // Marina: vogais = crítico
  bilingue: (p) => { p.mods.doubleShot = 0.2; },                     // Andréia
  imunidade: (p) => { p.mods.tonerImmune = true; },                  // Rosana
  estrategista: (p) => { p.mods.allyLifeMul = 1.5; },                // Felipe: aliados duram +50%
  cartografo: (p) => { p.mods.revealMap = true; },                   // William
  paleta_viva: (p) => { p.mods.paletaViva = true; }                  // Gabriela P.: poças e Obra-Prima ganham efeito
};

/** Efeitos sorteados pela Paleta Viva (mesmo formato dos efeitos das armas). */
export const PALETA_EFFECTS = [
  { type: 'fogo', chance: 1, duration: 3, power: 3 },
  { type: 'gelo', chance: 1, duration: 2, power: 0.5 },
  { type: 'veneno', chance: 1, duration: 4, power: 2 }
];

export function applyPassive(p, id) {
  if (id && PASSIVES[id]) PASSIVES[id](p);
}
