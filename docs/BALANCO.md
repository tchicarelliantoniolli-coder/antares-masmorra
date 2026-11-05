# Balanceamento: bot "dupla do dono"

O bot (`scripts/bot/bot.mjs`) joga partidas inteiras sem tela. O perfil `dupla` modela o dono e o amigo, que zeraram a v0.2 (3 andares) de primeira em dupla. Regra de calibração: o perfil **mais fraco** que vence **>= 80% de 30 partidas** com 2 jogadores na v0.2. Na Tarefa 12 a v0.3 é ajustada para que este mesmo perfil vença só 5 a 15%.

## Perfis finais

| Perfil | reaction (s) | aimError (graus) | dodge (chance por bala) | keepRange (px) | useSkill |
|---|---|---|---|---|---|
| dupla | 0.5 | 14 | 0.6 | 180 | não |
| experiente | 0.25 | 7 | 0.85 | 220 | sim |

- `reaction`: tempo que a bala fica visível antes do bot reagir a ela. Maior é pior.
- `aimError`: erro de mira (gaussiana, graus). Maior é pior.
- `dodge`: chance de o bot tentar desviar de cada bala. Menor é pior.
- Professores usados (`runMatch`, padrão): jogador 1 = `harilson`, jogador 2 = `marina`. Todos existem na v0.2 (14 professores jogáveis lá). Sementes padrão: 1 a 30 (`--seed0 1 --runs 30`).

## Mudanças no bot feitas na calibração

O bot da Tarefa 10 não vencia nem com perfil quase perfeito (0/30 com reaction 0.05, aimError 1, dodge 0.95: morria nos chefes e ficava sem energia). Problema de competência do bot, não do perfil. Correções pequenas, todas só no comportamento do bot:

1. Desvio de balas: antes o `reaction` estava invertido (menor reaction = reagir mais tarde) e o desvio era só "para o lado". Agora só reage a bala vista há `reaction` s e sorteada com `dodge`, e escolhe entre parar e 8 direções simulando 0,7 s à frente.
2. Energia: só recolhe armas de custo de energia 0 e de dano/s maior; troca para a arma de maior dano/s que a energia aguenta; sem energia na luta, busca esfera de energia próxima; entre lutas, recolhe energia se abaixo de 70%. (Armas caras zeravam a energia nas lutas de chefe.)
3. Armas corpo a corpo: não recolhe; se já tem uma, chega perto (45 px).
4. Armas caídas juntas: fica em cima da arma-alvo e desiste depois de 3 s se a interação vai para outro item (antes travava parado).
5. Alvo: prioriza a Diva (cura a Katia) quando está à vista.
6. `run.mjs`: nova opção `--set reaction=0.5,aimError=14` para sobrescrever números do perfil sem editar o bot.

## Armadilha: bug da Samara na v0.2

A v0.2 tem um crash conhecido (`rng.weighted` com todos os pesos zero em `samara.js choose()`; corrigido só na v0.3). Com o bot calibrado, **33% a 60% das partidas** da v0.2 original chegam ao andar 3 e caem nesse erro (o `run.mjs` as exclui das estatísticas). Como erram justamente as partidas que chegam à Samara, "vitórias sobre as válidas" subestima muito a taxa real. Por isso a calibração foi feita em uma cópia da v0.2 **com só essa correção da Samara** (a mesma lógica já presente na v0.3; cópia em `/tmp/antares-v02fix`, nada commitado), e o perfil final foi conferido também na v0.2 original (tabela abaixo). A decisão é do controlador se preferir outro critério.

## Rodadas de calibração (v0.2 + correção da Samara, 2 jogadores, 30 partidas, 0 erros)

Bot já com as correções acima. "Andar médio" = andar em que a partida terminou (3 = chegou à Samara/venceu).

| # | reaction | aimError | dodge | vitórias/30 | andar médio | motivos |
|---|---|---|---|---|---|---|
| 1 | 0.05 | 1 | 0.95 | 29 (97%) | 2.97 | 1 stuck@2 |
| 2 | 0.35 | 9 | 0.35 (perfil antigo) | 19 (63%) | 2.70 | 9 derrotas@2, 1 derrota@3, 1 stuck@3 |
| 3 | 0.25 | 6 | 0.55 | 27 (90%) | 2.93 | 2 derrotas@2, 1 stuck@3 |
| 4 | 0.35 | 9 | 0.6 | 24 (80%) | 2.77 | 4 derrotas@2, 2 stuck |
| 5 | 0.35 | 5 | 0.35 | 20 (67%) | 2.77 | 7 derrotas, 3 stuck |
| 6 | 0.5 | 9 | 0.6 | 26 (87%) | 2.90 | 3 derrotas@2, 1 derrota@3 |
| 7 | 0.35 | 14 | 0.6 | 25 (83%) | 2.87 | 4 derrotas@2, 1 stuck@3 |
| 8 | 0.5 | 14 | 0.5 | 21 (70%) | 2.77 | 8 derrotas, 1 stuck |
| 9 | 0.5 | 14 | 0.4 | 17 (57%) | 2.60 | 12 derrotas, 1 stuck |
| 10 | 0.7 | 14 | 0.6 | 17 (57%) | 2.63 | 11 derrotas@2, 2 stuck@3 |
| **11** | **0.5** | **14** | **0.6** | **24 (80%)** | 2.83 | 5 derrotas@2, 1 derrota@3 |
| 12 | 0.6 | 9 | 0.6 | 23 (77%) | 2.80 | 5 derrotas, 2 stuck |
| 13 | 0.5 | 14 | 0.55 | 18 (60%) | 2.67 | 11 derrotas, 1 stuck |

Leitura: `dodge` é o botão que mais pesa (limiar em torno de 0.6; 0.55 já cai para 60%). `aimError` quase não muda o resultado (5 a 14 graus). `reaction` até 0.5 é tolerado; 0.7 derruba. A rodada 11 é o conjunto mais fraco testado que chega a 80% (reaction maior, dodge menor ou reaction 0.6 com aim 9 ficam abaixo). Com 30 partidas e 80% exatos a margem é pequena; sementes diferentes podem dar +-7 pontos.

Antes das correções do bot (rodadas de diagnóstico, v0.2 com Samara corrigida): perfil quase perfeito 0/30 (andar médio 1.76), `0.15/3/0.75` 0/30; morria nos chefes (Máquina de Xerox e Katia) e por falta de energia.

## Rodadas na v0.2 original (válidas = sem o crash da Samara)

| reaction | aimError | dodge | válidas | erros Samara | vitórias/válidas | andar médio |
|---|---|---|---|---|---|---|
| 0.05 | 1 | 0.95 | 20 | 10 | 19 (95%) | 2.95 |
| 0.35 | 9 | 0.35 | 19 | 11 | 9 (47%) | 2.53 |
| 0.25 | 9 | 0.35 | 20 | 10 | 9 (45%) | 2.45 |
| 0.35 | 9 | 0.65 | 16 | 14 | 7 (44%) | 2.44 |
| 0.35 | 4 | 0.35 | 17 | 13 | 9 (53%) | 2.65 |
| 0.25 | 6 | 0.55 | 15 | 15 | 12 (80%) | 2.87 |
| 0.5 | 14 | 0.6 (final) | 12 | 18 | 7 (58%) | 2.58 |

## Resultados finais na v0.2 (30 partidas, sementes 1 a 30)

| Perfil | Jogadores | Base | Válidas | Vitórias | Andar médio | Tempo médio | Motivos |
|---|---|---|---|---|---|---|---|
| dupla | 2 | v0.2 + correção Samara | 30/30 | **24/30 (80%)** | 2.83 | 631 s | 5 derrotas@2, 1 derrota@3 |
| dupla | 2 | v0.2 original | 12/30 (18 erros Samara) | 7/12 (58%) | 2.58 | 565 s | 5 derrotas@2 |
| dupla | 1 | v0.2 (sem erros) | 30/30 | 1/30 (3%) | 2.07 | 449 s | 28 derrotas@2, 1 stuck@3 |
| experiente | 1 | v0.2 (sem erros) | 30/30 | 9/30 (30%) | 2.37 | 544 s | 13 derrotas (12@2), 8 stuck |
| experiente | 2 | v0.2 + correção Samara | 30/30 | 27/30 (90%) | 2.97 | 573 s | 3 stuck |
| experiente | 2 | v0.2 original | 16/30 (14 erros Samara) | 13/16 (81%) | 2.94 | 560 s | 3 stuck |

Observações: sozinho o bot morre no andar 2 (Katia) quase sempre; o jogo da v0.2 foi desenhado e vencido em dupla. "stuck" = 20 s sem causar dano nem mudar de sala (geralmente luta de chefe sem energia ou invulnerabilidade do caderno da Samara).

## Como repetir

```
git worktree add /tmp/antares-v02 4a52203 && ln -s "$PWD/node_modules" /tmp/antares-v02/node_modules
node scripts/bot/run.mjs --root /tmp/antares-v02 --profile dupla --players 2 --runs 30
node scripts/bot/run.mjs --root /tmp/antares-v02 --profile dupla --players 2 --runs 30 --set reaction=0.5,aimError=14,dodge=0.6
node scripts/bot/run.mjs --root . --profile dupla --players 2 --runs 30   # v0.3
```

Na v0.2 original o `run.mjs` termina com código 1 quando há erro de simulação (esperado: crash da Samara). Para reproduzir a linha "v0.2 + correção Samara", aplique no worktree (sem commitar) a mesma proteção de `choose()` que existe em `shared/sim/inimigos/chefes/samara.js` da v0.3.

## Dificuldade da v0.3 (Tarefa 12)

Alvos (30 partidas por linha): dupla 2j 5-15%, dupla 1j 5-15%, experiente 1j e 2j 25-40%. Bot e perfis NÃO foram alterados. Alavancas ficam em `shared/data/enemies.json` (bloco `difficulty` e campos de cada andar). Cada célula: vitórias/partidas (andar médio).

### Rodadas (sementes 1-30, salvo indicação)

| # | Mudança | dupla 2j | dupla 1j | exp. 1j | exp. 2j |
|---|---|---|---|---|---|
| 0 | v0.3 como estava (hpScale 1/1.35/1.7, +1 inimigo por jogador extra) | 9 (30%) 2.33 | 0 (0%) 1.80 | 0 (0%) 2.20 | 14 (47%) 2.83 |
| 1 | + escudo 5 s, cura mais rara (maçã do chão 12%, maçã da loja +2, enfermaria cura metade, preços x1.3), +40% inimigos e +25% vida por jogador extra | 0 (0%) 2.03 | 0 1.80 | 0 2.13 | 2 (7%) 2.73 |
| 2 | hpScale 1/1.15/1.3, +50% inimigos, +40% vida por extra | 0 1.90 | 0 1.80 | 3 (10%) 2.47 | 6 (20%) 2.37 |
| 3 | idem 2 com cura da v0.2 (teste isolado) | 0 1.83 | 0 1.80 | 1 2.50 | 4 2.37 |
| 4 | cura nerfada de volta; hpScale 1/1.0/1.15, elite 0.06/0.08/0.12, extra vida 0.3, chefe +0.8/jogador | 3 (10%) 2.13 | 0 1.90 | 5 (17%) 2.57 | 14 (47%) 2.73 |
| 5 | vida base Katia 540->470, Samara 680->580; chefe +1.0/jogador | 2 (7%) 2.07 | 0 1.83 | 2 (7%) 2.30 | 16 (53%) 2.77 |
| 6 | ondas 3-5 (andar 2) e 4-6 (andar 3); +60% inimigos por extra | 1 (3%) 2.03 | 0 1.87 | 4 (13%) 2.77 | 10 (33%) 2.37 |
| 7 | Samara 580->480, hpScale andar 3 1.15->1.05 | 2 (7%) 2.03 | 0 1.87 | 9 (30%) 2.77 | 11 (37%) 2.37 |
| 8 | balas +20% andares 2 e 3 (+10% andar 1) | 1 (3%) 2.00 | 0 1.83 | 4 (13%) 2.27 | 8 (27%) 2.50 |
| 9 | balas +10% (todos) | 2 (7%) 2.07 | 0 1.87 | 6 (20%) 2.50 | 14 (47%) 2.60 |
| 10 | extra vida 0.4 | 2 (7%) 2.07 | 0 1.87 | 6 (20%) 2.50 | 6 (20%) 2.40 |
| 11 | extra vida 0.35, balas andar 1 x1.0 (30 part.) | 0 1.90 | 0 1.83 | 5 (17%) 2.47 | 13 (43%) 2.53 |

Com 30 partidas o ruído é de +-8 pontos (uma mudança minúscula troca todos os caminhos aleatórios), então a partir da rodada 11 as decisões foram tomadas com **60 partidas** (sementes 1-60):

| # | Mudança | dupla 2j | dupla 1j | exp. 1j | exp. 2j |
|---|---|---|---|---|---|
| 12 | (estado da 11) | 0/60 (0%) | 1/60 (2%) | 9/60 (15%) | 23/60 (38%) |
| 13 | extra vida 0.3, balas x1.0 (andar 2) e x1.15 (andar 3) | 5/60 (8%) | 1/60 (2%) | 24/60 (40%) | 24/60 (40%) |
| 14 | balas andar 3 x1.2 | 3/60 (5%) | 2/60 (3%) | 12/60 (20%) | 23/60 (38%) |
| **15** | balas andar 3 x1.17 (**final**) | **4/60 (7%)** | 0/60 (0%) | **17/60 (28%)** | **23/60 (38%)** |

O solo do experiente é muito sensível à velocidade das balas do andar 3 (1.15 -> 1.2 derruba de 40% para 20%).

### Resultado final (configuração da rodada 15)

| Linha | Sementes 1-30 | Sementes 31-60 (confirmação) | 60 partidas | Alvo |
|---|---|---|---|---|
| dupla 2j | 1/30 (3%), andar 2.03 | 3/30 (10%), andar 2.07 | **4/60 (7%)** | 5-15% ok |
| dupla 1j | 0/30 (0%), andar 1.87 | 0/30 (0%), andar 2.07 | 0/60 (0%) | 5-15% **não atingido** |
| experiente 1j | 8/30 (27%), andar 2.77 | 9/30 (30%), andar 2.63 | **17/60 (28%)** | 25-40% ok |
| experiente 2j | 15/30 (50%), andar 2.37 | 8/30 (27%), andar 2.47 | **23/60 (38%)** | 25-40% ok (50% na primeira série, ruído) |

Motivos de derrota (dupla 2j, 60 partidas): ~39 no andar 2, 8 no andar 1, 8 no andar 3 (chefe), restante travadas. Ou seja morre sobretudo no andar 2, como pedido.

### Conflito: dupla com 1 jogador (0%, alvo 5-15%)
O perfil dupla já vencia só 3% sozinho na v0.2 (Tarefa 11) e morre no andar 2 em ~70% das partidas. Para chegar a 5% sozinho seria preciso suavizar o andar 2 base, o que também suaviza a dupla de 2 jogadores (alvo prioritário, 5-15%) e leva o experiente acima de 40%. Mantido em ~0-3% (nunca mais fácil que a v0.2 solo). Um jogador fraco sozinho não vence a v0.3; um jogador experiente sozinho vence ~28%.

### Alavancas finais (antes -> depois)
- Escala por jogador extra (comuns): inimigos +1 -> +60% da onda (`difficulty.extraEnemies`); vida 0 -> +30% (`difficulty.extraHp`). Chefes: vida +60% -> +100% por jogador (`difficulty.bossHpPerPlayer`).
- Base mais fácil (para o solo): `hpScale` 1/1.35/1.7 -> 1/1/1.05; `eliteChance` 0.06/0.12/0.2 -> 0.06/0.08/0.12; ondas 4-6 e 5-7 -> 3-5 e 4-6 (andares 2 e 3); vida Katia 540 -> 470, Samara 680 -> 480.
- Balas inimigas: `bulletSpeedMul` por andar 1/1/1.17 (andar 1 e 2 sem aumento: o dupla morria no andar 1 com qualquer aumento).
- Cura: maçã do chão 25% -> 12% (`dropHealthChance`); maçã da loja 3 -> 2; enfermaria cura metade da vida máxima (soma, não enche); preços da loja e estátua x1.3; `SHIELD_REGEN_DELAY` 4 -> 5.
- Não alterados: dano dos ataques (régua, apontador, grampeador, mochila já tiram 2 desde a Tarefa 5), telégrafos, armas (`weapon-dps`: 0 fora da faixa).
- Observação: o bot não compra na loja, então o preço x1.3 não influencia as taxas medidas.

### Correção de bug (afeta só a v0.3)
`samara.js choose()`: o recurso de emergência (restrições zeraram tudo) podia reabilitar "suspensao" sem jogador livre e quebrar (`v` indefinido). Agora mantém o peso 0 sem jogadores livres.

## Confirmação com seeds novas (61-90)

A Tarefa 12 ajustou tudo nas sementes 1-60. Para conferir sem viés, 30 partidas novas por linha (`--seed0 61`), sem reajustar nada:

| Linha | Vitórias (61-90) | Andar médio | Alvo |
|---|---|---|---|
| dupla 2j | 2/30 (7%) | 2.17 | 5-15% ok |
| experiente 1j | 6/30 (20%) | 2.37 | 25-40% um pouco abaixo (ruído de +-8 pontos; 8 partidas "travadas" contam como não vitória) |
| experiente 2j | 17/30 (57%) | 2.60 | 25-40% acima (mesmo perfil deu 38% em 60 partidas e 27% a 50% em séries de 30) |

A linha principal (dupla 2j) se confirmou. O experiente oscila para os dois lados com 30 partidas; nada foi retocado.

## Como recalibrar depois que o dono jogar

1. Anote o resultado real: venceu? Em que andar caiu e em qual sala/chefe? Foi fácil, injusto ou chato?
2. Rode a linha de base com o bot antes de mexer (`--runs 60` reduz o ruído; 30 partidas variam +-8 pontos):

   ```bash
   node scripts/bot/run.mjs --root . --profile dupla --players 2 --runs 60
   node scripts/bot/run.mjs --root . --profile experiente --players 1 --runs 60
   ```

   Opções úteis: `--seed0 N` (outras sementes), `--set reaction=0.5,aimError=14` (afinar o perfil sem editar o bot), `--players 1|2`.
3. Se o jogo real foi **fácil demais** ou **difícil demais**, mexa em poucas alavancas por vez, sempre em `shared/data/enemies.json`:
   - `difficulty.extraEnemies` e `difficulty.extraHp`: peso de cada jogador extra nos inimigos comuns (mais dupla = mais difícil).
   - `difficulty.bossHpPerPlayer`: vida extra dos chefes por jogador extra.
   - `difficulty.dropHealthChance`, `appleHeal`, `healStationFraction`: quanta cura o jogador recebe.
   - `difficulty.priceMul`: preços da loja e da estátua (o bot não compra, então não aparece nas taxas dele).
   - Por andar em `floors[]`: `hpScale` (vida), `bulletSpeedMul` (velocidade das balas, muito sensível no andar 3), `eliteChance`, `wavesPerRoom`, `enemiesPerWave`, `enemyPool` (pesos dos tipos) e a vida dos chefes em `enemies`.
4. Rode de novo as quatro linhas (dupla 2j/1j, experiente 2j/1j) com as mesmas sementes e compare. Metas: dupla 2j 5-15%, experiente 1j 25-40%, experiente 2j 25-40%.
5. Confirme com sementes novas (`--seed0 61`), `npm test` e `node scripts/weapon-dps.mjs` (0 armas fora da faixa) antes de commitar.

Dica: o perfil `dupla` representa dois jogadores medianos; se o dono ganha com folga, aperte `bulletSpeedMul` do andar 2 ou 3; se morre no andar 1, alivie `hpScale`/`enemiesPerWave` do andar 1.
