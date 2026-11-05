# Task 10 report: bot que joga partidas

## Implementado
- `scripts/bot/bot.mjs` (~290 linhas): `PROFILES` (dupla, experiente), `createBot`, `runMatch` (aceita `worldOpts` extra, ex.: roomCount/maxFloors; reason inclui `'error'` se a simulacao lancar excecao), `mulberry32`.
- `scripts/bot/run.mjs`: importa World/loadGameDataNode de `<root>/shared/sim/` por import() dinamico; imprime tabela.
- `test/bot.test.js`: 2 testes.
- Bot nao importa nada de `shared/`; so usa API publica comum a v0.2 e v0.3 (comparei World.js, Pickups.js, TileMap.js, Projectiles.js, Player.js com 4a52203: campos `pickups[].kind/opened/used/weaponId`, `rooms[].state/type/cx/cy`, `projectiles[].team/vx/vy/r`, `p.downed/weapons/interactTarget/roomId`, `map.isSolidTile/lineOfSight/solidAt/locked` existem nas duas). `p.wstate?.chargeFull` e `aimDist` sao opcionais (v0.2 ignora).
- Navegacao: BFS (campo de distancias) em tiles, cache por tile alvo, invalidado quando muda andar/portas travadas/sala ativa ou a cada 1 s; objetivo reavaliado a cada 0,25 s. Waypoint = ponto mais longe (ate 8 tiles) com linha reta livre.
- Extra: se 4 s sem causar dano em luta e ha 2 armas, troca de arma (armadilha de chao nao acerta voadores; sem isso travava com `tachinhas_chao`).

## TDD
RED: `Cannot find module '.../scripts/bot/bot.mjs'` (# pass 0, # fail 1).
GREEN: `node --test test/bot.test.js` -> pass 2, fail 0, ~0,4 s. `npm test` -> 160 pass, 0 fail.

## run.mjs
`--profile experiente --players 1 --runs 3`: 0/3 vitorias, andar medio 2.67, tempo medio 386 s, derrotas {"defeat@2":1,"defeat@3":2}; 1,4 s reais.
`--profile dupla --players 2 --runs 10`: 1/10 vitorias, andar medio 2.30, 6 s reais (30 partidas ~ 20 s).

## Concerns
1. Brief pede `roomCount: 2`: impossivel, o gerador exige >= 3 salas de combate + 3 especiais + entrada + chefe, ou seja roomCount >= 6 ("Falha ao gerar o andar"). Teste usa 6.
2. BUG REAL NO SIM (existe desde a v0.2): `shared/sim/inimigos/chefes/samara.js` `choose()`: no P1 (advertencia/caderno/suspensao), se lastAttack=advertencia, ja existe caderno_preto vivo e suspensao esta zerada (jogador preso/sem alvo livre), todos os pesos ficam 0 e `rng.weighted` lanca TypeError, derrubando a partida. Reproduz com `--profile dupla --players 2 --runs 10` (seed 5). runMatch captura e devolve reason `error` (aparece na tabela); nao corrigi (fora do escopo). Corrigir antes da Tarefa 11/12 ou os numeros ficam contaminados.
3. Perfis sao chute; bot nao usa loja/estatuas/dinheiro. Vitorias ainda raras (bot pode estar fraco), calibrar na Tarefa 11.
4. Nao verifiquei contra codigo v0.2 de fato (sem worktree); so comparei APIs por `git show`.
5. `stuck` pode ser disparado por luta longa sem dano; a troca de arma mitiga.

## Fix round 1
1. run.mjs: linhas "partidas válidas" e "erros de simulação"; médias/vitórias/motivos só com partidas válidas; stderr mostra as 3 primeiras linhas da stack (runMatch devolve `stack`); exit 1 se houve erro.
2. Samara (`samara.js` choose()): se todos os pesos zeram, restaura os pesos-base da fase (menos lastAttack); se ainda zero, usa 'advertencia'. Teste em `test/floors.test.js` (lastAttack=advertencia + caderno vivo + jogador preso): RED (TypeError) sem o fix, GREEN com ele. rng.weighted continua estrito.
3. bot.mjs: removidos `rank`, `* 1.0` e o `* -1` duplo (sinais equivalentes); comentário explicando a troca automática de arma.
Resultado: npm test 161/161; `run.mjs dupla --players 2 --runs 10`: 10/10 válidas, 0 erros, 2/10 vitórias, exit 0.
