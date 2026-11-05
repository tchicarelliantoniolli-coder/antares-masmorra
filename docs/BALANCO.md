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
