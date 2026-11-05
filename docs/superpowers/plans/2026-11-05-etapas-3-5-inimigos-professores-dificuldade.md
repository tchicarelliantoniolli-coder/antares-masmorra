# Etapas 3, 4 e 5 (inimigos, 14 professores, dificuldade) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inimigos com mecânicas distintas (6 refeitos, 7 novos, elites com modificadores), os 8 professores bloqueados jogáveis com habilidades e passivos, e o jogo calibrado por bots para que só jogadores bons terminem.

**Architecture:** Comportamentos de inimigo são funções em `shared/sim/inimigos/behaviors.js` (uma por mecânica) escolhidas por `behavior` no `enemies.json`; avisos de ataque ficam em `e.telegraph` e o renderizador desenha os de qualquer inimigo. Aliados invocados generalizam `ALLY_KINDS` (Etapa 2) com vida própria e viram alvo dos inimigos. Habilidades novas entram em `shared/sim/personagens/skills.js`. Um bot sem interface (`scripts/bot/`) joga partidas inteiras contra qualquer versão da simulação para calibrar a dificuldade.

**Tech Stack:** JavaScript ES modules, Phaser 3 (cliente), Node 18+ (`node --test`), Socket.io, Playwright (teste de fumaça).

**Spec:** `docs/superpowers/specs/2026-11-05-armas-inimigos-professores-dificuldade-design.md` (seções 5.3, 5.4, 5.5 e 6). Plano anterior (já executado, define as interfaces de armas usadas aqui): `docs/superpowers/plans/2026-11-05-etapas-1-2-menu-revive-armas.md`.

## Global Constraints

- Lógica de jogo só em `shared/sim/`, sem Phaser; roda igual no navegador e no servidor online.
- Tudo que o renderizador desenha precisa ir no snapshot (`shared/net/snapshot.js`) e aparecer certo no modo online.
- Todo ataque perigoso de inimigo tem aviso visível antes (anti-meta do spec: nada de dano sem aviso).
- Inimigos, andares e números editáveis em `shared/data/enemies.json`; professores em `shared/data/characters.json`.
- Sprites provisórios gerados por código (`client/src/render/*Art.js` + `SpriteFactory.js`), com chave substituível.
- Textos do jogo em português do Brasil; tema escolar; nada copiado de outro jogo.
- `npm test` passa ao fim de cada tarefa; `node scripts/smoke.mjs` (servidor rodando com o código atual) passa ao fim de cada tarefa que mexe no cliente.
- Antes de rodar `scripts/smoke.mjs`, reinicie o servidor (`npm start`) para ele carregar o código e os dados atuais.
- Commits pequenos no branch `claude/v0.3-armas-inimigos`, mensagens em português, terminando com as linhas de atribuição da sessão.

## Review Focus

1. **Inimigo enterrado, invulnerável (estojo fechado) ou teleportando no momento em que a sala acaba ou o andar troca**: a sala destranca quando todos morrem, nada fica preso fora do mapa. Teste na Tarefa 2 e 3.
2. **Habilidade usada sem alvo** (Translate/Circuito sem inimigos perto, Linha do Tempo no primeiro segundo da partida, Vulcão mirando parede): não dá erro, gasta ou não a recarga de forma consistente (gasta). Teste na Tarefa 7 e 8.
3. **Aliados invocados quando o dono cai, sai da partida online ou o andar troca**: somem ou continuam sem erro; nenhum aliado ataca jogador. Teste na Tarefa 6.
4. **Co-op com 2 jogadores escolhendo os professores novos no online** (lobby, `setCharacter`, snapshot com estados novos): funciona do lobby até a partida. Teste na Tarefa 9.
5. **Dificuldade no co-op**: dupla não pode ser mais fácil que solo (escala por jogador nos inimigos comuns). Medido pelo bot na Tarefa 12.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `shared/sim/inimigos/Enemy.js` | criação (elite com modificador), alvo (`nearestTarget`), tiro com mira prevista, dano de contato, status `confused`/`linked` |
| `shared/sim/inimigos/behaviors.js` | comportamentos refeitos e novos |
| `shared/sim/inimigos/affixes.js` (novo) | modificadores de elite |
| `shared/sim/combat.js` | dano em inimigo (blindado, vampiro, circuito, reação em cadeia, alta voltagem), dano em aliado |
| `shared/sim/areas.js` | áreas novas: `ink_trail`, `fire_ground`, `painting`, `volcano`, `warn_circle` |
| `shared/sim/personagens/Allies.js` | aliados com vida, tipos de invocação (soldados e personagens), alvo dos inimigos |
| `shared/sim/personagens/skills.js`, `passives.js` | 8 habilidades e passivos novos |
| `shared/sim/World.js` | histórico curto do time (Linha do Tempo) |
| `shared/data/enemies.json`, `shared/data/characters.json` | dados |
| `shared/net/snapshot.js` | bandeiras de inimigo (`shielded`, `burrowed`, `confused`, `linked`), modificador de elite, telegraph, vida de aliado |
| `client/src/render/enemyArt.js`, `propArt.js`, `SpriteFactory.js`, `WorldRenderer.js`, `Effects.js` | sprites e desenho dos estados novos |
| `client/src/scenes/CharacterSelectScene.js`, `LobbyScene.js`, `HudScene.js`, `server/RoomManager.js` | os 14 jogáveis, ícones de habilidade |
| `scripts/bot/bot.mjs`, `scripts/bot/run.mjs` (novos) | bot e corrida de calibração |
| `docs/BALANCO.md` (novo) | resultados da calibração |
| `test/enemies.test.js`, `test/professores.test.js`, `test/bot.test.js` (novos) | testes |

Helpers de teste já existentes em `test/helpers.js`: `makeWorld`, `putInRoom`, `run`, `dummy`, `withWeapon`, `arena` (sala limpa, jogador no centro, energia infinita), `wallDistRight`, `countEvents`. Para inimigos reais, crie com `createEnemy(world, type, x, y, room.id, { spawnTime: 0 })`.

---

## Etapa 3 — Inimigos

### Task 1: Base para inimigos novos (avisos, alvo, mira prevista, áreas, snapshot)

**Files:**
- Modify: `shared/sim/inimigos/Enemy.js`, `shared/sim/areas.js`, `shared/net/snapshot.js`, `client/src/render/WorldRenderer.js`
- Test: `test/enemies.test.js` (novo)

**Interfaces:**
- Produces:
  - `e.telegraph` aceita `{ type: 'line', angle, length, width }` (já existe para chefes) e `{ type: 'circle', x, y, r }`. `WorldRenderer.sync` desenha o telegraph de **todo** inimigo vivo (hoje só o do chefe).
  - `predictAim(e, target, bulletSpeed, lead = 1): number` em `Enemy.js` — ângulo mirando onde o alvo estará (`target.vx/vy` × tempo de voo × `lead`; alvos sem `vx` = mira direta).
  - `nearestTarget(world, e): Player | Ally | null` em `Enemy.js` — jogador ou aliado com `hp > 0` mais próximo (aliados só se `a.taunt === true`). `updateEnemies` passa a usar `nearestTarget`. Chefes continuam usando `nearestPlayer`/`targetablePlayers` nos ataques especiais.
  - Flags no inimigo: `e.shielded` (já respeitado em `damageEnemy`), `e.burrowed` (invisível, intocável, sem contato), `e.status.confused` (Etapa 4), `e.linked` (Etapa 4), `e.affix` (Tarefa 4).
  - Áreas novas em `areas.js`: `ink_trail` (jogador dentro anda a 55%, `life` 3 s), `fire_ground` (jogador dentro leva `damage` a cada 0,6 s, `life` 3 s), `warn_circle` (só visual, aviso genérico).
  - Snapshot de inimigo ganha índice 17 `flags` (bits: 1 shielded, 2 burrowed, 4 confused, 8 linked) e 18 `affix` (string ou 0); `decodeSnapshot` remonta `e.shielded`, `e.burrowed`, `e.status.confused`, `e.linked`, `e.affix`.
- [ ] **Step 1: Testes** em `test/enemies.test.js`: `predictAim mira à frente de alvo em movimento` (alvo andando para cima: ângulo menor que o direto); `nearestTarget prefere aliado com taunt mais perto que o jogador`; `ink_trail deixa o jogador lento e some depois de life`; `fire_ground machuca jogador a cada 0,6 s`; `snapshot leva flags e affix do inimigo` (decodificado igual ao original).
- [ ] **Step 2: Rodar e ver falhar** — `node --test test/enemies.test.js`.
- [ ] **Step 3: Implementar.** No `WorldRenderer`, extrair `drawTelegraph(e)` para aceitar `line` e `circle` e chamar para todo inimigo com `telegraph`; inimigo `burrowed`: esconder o corpo e desenhar um monte de terra que se mexe.
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: base para inimigos novos (avisos, alvo, mira prevista, áreas)`

### Task 2: Os 6 inimigos atuais refeitos

**Files:**
- Modify: `shared/sim/inimigos/behaviors.js`, `shared/data/enemies.json`, `client/src/render/WorldRenderer.js` (estojo fechado, aviso do bote), `client/src/render/enemyArt.js` (quadro "fechado" do estojo)
- Test: `test/enemies.test.js`

**Interfaces (mecânicas do spec 5.3, nomes de behavior):**
- `chaser` (Caderno Zumbi): mantém o bote com aviso `line` durante o preparo; o bote deixa `ink_trail` no caminho (uma área a cada ~30 px).
- `shooter` (Prova Voadora): `attack.burst` (padrão 3) tiros com `predictAim`, 0,12 s entre eles.
- `fan_shooter` (Estojo Raivoso): novo comportamento próprio. Fica `closed` (`e.shielded = 1`, invulnerável, anda devagar) e a cada `attack.interval` abre (`state 'open'`), dá aviso, solta o leque e fica aberto `openTime` (1,2 s) — só aí leva dano.
- `turret` (Lousa): espiral giratória — a cada `attack.interval` dispara `attack.arms` (3) braços que giram `attack.turnRate` rad/s por `attack.duration` s (1 tiro por braço a cada 0,15 s); aviso: brilho no windup.
- `ringer` (Sinal do Recreio): mantém anéis com abertura; anéis alternam velocidade (rápido/lento).
- `kamikaze` (Mochila-Bomba): corre em zigue-zague (seno perpendicular); aviso `circle` do raio da explosão no pavio; ao explodir deixa `fire_ground` por 3 s.
- [ ] **Step 1: Testes:** `caderno: bote mostra aviso antes e deixa rastro de tinta`; `prova: rajada de 3 com mira prevista`; `estojo: fechado não leva dano; aberto leva`; `lousa: tiros saem em ângulos que giram ao longo do ataque`; `mochila: aviso circular no pavio e chão em chamas depois`; `sala com estojo fechado destranca quando todos morrem` (matar com dano alto durante a janela aberta; sala `cleared`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test` e `node scripts/smoke.mjs`.
- [ ] **Step 5: Commit** — `feat: inimigos atuais com mecânicas próprias`

### Task 3: Os 7 inimigos novos

**Files:**
- Modify: `shared/sim/inimigos/behaviors.js`, `shared/sim/inimigos/Enemy.js` (morte que divide), `shared/sim/combat.js` (`killEnemy` chama `onDeath` do comportamento), `shared/data/enemies.json`, `client/src/render/enemyArt.js`, `client/src/render/SpriteFactory.js`
- Test: `test/enemies.test.js`

**Interfaces (spec 5.3; ids e behaviors):**

| id | nome | behavior | mecânica | andares |
|---|---|---|---|---|
| `borracha` | Borracha Divisora | `splitter` | ao morrer vira 2 com metade da vida e 80% do tamanho; os filhos (`gen: 1`) se dividem mais uma vez (`gen: 2` não) | 1–3 |
| `grampeador` | Grampeador Touro | `charger` | mira com aviso `line` por 0,8 s, investe em linha reta a 420 px/s; ao bater na parede fica `stunned` 1,2 s (leva dano dobrado) | 1–3 |
| `regua_mira` | Régua Mira-Laser | `sniper` | fica longe (280–420 px); aviso `line` fino por 1 s seguindo o alvo e travando nos últimos 0,25 s; tiro rápido (650 px/s) de dano 2 | 2–3 |
| `apontador` | Apontador Escavador | `burrower` | `burrowed` por 2–3 s indo até o alvo; para, aviso `circle` 0,8 s sob o alvo, emerge (dano 2 em quem estiver no círculo) e fica exposto 2 s | 2–3 |
| `monitor` | Monitor de Turma | `summoner` | fica longe, a cada 5 s (aviso: brilho 0,6 s) chama 2–3 `caderno_zumbi` `minion` (máx. 6 vivos); prioridade de abate | 2–3 |
| `gremio` | Grêmio Estudantil | `buffer` | foge do jogador; a cada 3 s dá escudo de 1 golpe (`e.shielded = 1` até o próximo dano) ou cura 20% num aliado inimigo a até 200 px; linha visível (`e.healTarget`) | 3 |
| `chamada` | Chamada Fantasma | `blinker` | aviso `circle` 0,6 s num ponto a 90–140 px do alvo, teleporta, solta rajada de 5 em leque com `predictAim`, some de novo após 0,8 s | 3 |

- Números iniciais (vida, velocidade, dano) no JSON seguindo os atuais (vida 8–30); a Tarefa 12 ajusta.
- Sprites: um desenho por inimigo novo (2 quadros), no estilo de `drawCadernoZumbi`; registrar `enemy_<id>` e a animação `enemy_<id>_move` no `SpriteFactory` (a lista de animações hoje é fixa: transformar em laço sobre `Object.keys(data.enemies)` que tenham textura).
- `killEnemy` chama `BEHAVIOR_HOOKS[e.def.behavior]?.onDeath(world, e)` (exportado de `behaviors.js`).
- [ ] **Step 1: Testes** (um por inimigo, mais): `borracha divide 2 vezes e para` (matar até sobrar nenhuma: 1 → 2 → 4 inimigos mortos no total, 7 mortes); `grampeador bate na parede e fica tonto`; `régua: aviso antes do tiro e tiro de dano 2`; `apontador: enterrado não leva dano nem empurra; emerge sob o jogador depois do aviso`; `monitor: invoca no máximo 6 e os invocados não dão drop`; `grêmio: dá escudo a um inimigo e foge`; `chamada: aviso e teleporte para perto do jogador`; `inimigo enterrado ou teleportando quando o andar troca não dá erro` (chamar `completeFloor`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** (comportamento + dados + sprite de cada um).
- [ ] **Step 4: Rodar** — `npm test` e `node scripts/smoke.mjs` (o cenário `galeria` precisa listar os inimigos novos sem erro).
- [ ] **Step 5: Commit** — `feat: 7 inimigos novos`

### Task 4: Elites com modificadores e andares com papéis misturados

**Files:**
- Create: `shared/sim/inimigos/affixes.js`
- Modify: `shared/sim/inimigos/Enemy.js` (`createEnemy` sorteia modificador), `shared/sim/combat.js`, `shared/sim/salas/RoomDirector.js` (`spawnWave`), `shared/data/enemies.json` (`floors[].enemyPool`, `floors[].waveRoles`), `client/src/render/WorldRenderer.js` (ícone/cor do modificador)
- Test: `test/enemies.test.js`

**Interfaces:**
- `AFFIXES = { rapido, blindado, explosivo, vampiro, duplicador }` em `affixes.js`, cada um `{ label, color, onCreate?(world, e), onHit?(world, e, player), onDamaged?(world, e), onDeath?(world, e) }`:
  - `rapido`: velocidade ×1,4 e intervalo de ataque ×0,8.
  - `blindado`: começa com `e.shielded = 1` (o primeiro golpe só quebra o escudo) e recupera o escudo a cada 6 s sem levar dano.
  - `explosivo`: ao morrer, aviso `circle` 0,7 s e explosão (raio 60, dano 2 no jogador).
  - `vampiro`: ao acertar jogador (contato ou bala), cura 25% da vida máxima.
  - `duplicador`: ao chegar a 50% de vida pela primeira vez, cria uma cópia (não elite) ao lado.
- `createEnemy` com `elite: true` sorteia `e.affix` (chefes nunca). Elite continua com o dobro de vida.
- `floors[i].waveRoles`: lista de papéis por onda que `spawnWave` tenta cobrir antes de sortear o resto do `enemyPool`. Papéis: `tanque` (caderno_zumbi, estojo, grampeador), `atirador` (prova_voadora, lousa, regua_mira, sinal_recreio), `pressao` (mochila, borracha, apontador, chamada), `suporte` (monitor, gremio). Andar 1: `["tanque","atirador"]`; andar 2: `["tanque","atirador","pressao"]`; andar 3: `["tanque","atirador","pressao","suporte"]`. Cada inimigo em `enemies.json` ganha `"role"`.
- `enemyPool` de cada andar inclui os inimigos novos conforme a coluna "andares" da Tarefa 3.
- [ ] **Step 1: Testes:** um por modificador; `elite sempre tem modificador e chefe nunca`; `onda do andar 3 tem pelo menos um de cada papel quando cabe` (onda com 5+ inimigos); `todo inimigo do enemyPool de cada andar existe e tem role`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test` e `node scripts/smoke.mjs`.
- [ ] **Step 5: Commit** — `feat: elites com modificadores e ondas com papéis`

---

## Etapa 4 — Os 8 professores

### Task 5: Aliados com vida e alvo dos inimigos

**Files:**
- Modify: `shared/sim/personagens/Allies.js`, `shared/sim/inimigos/Enemy.js` (contato em aliado), `shared/sim/armas/Projectiles.js` (bala inimiga acerta aliado), `shared/sim/combat.js` (`hurtAlly`, explosões ferem aliados de quem é inimigo), `shared/net/snapshot.js` (aliado ganha `hp`, `maxHp`), `client/src/render/WorldRenderer.js` (barra de vida do aliado)
- Test: `test/professores.test.js` (novo)

**Interfaces:**
- `createAlly(world, kind, x, y, opts)` aceita `hp` (sem `hp` = indestrutível, como mina) e `taunt` (inimigos miram nele).
- `hurtAlly(world, a, amount): void` em `combat.js` — tira vida; com `hp <= 0` o aliado morre (`ally_end`).
- Planta e torreta passam a ter `hp: 15`/`hp: 20` e `taunt: true`; mina não.
- Tipos novos em `ALLY_KINDS` (usados na Tarefa 6), todos com `taunt: true`:
  - `legionario`: corpo a corpo, anda até o inimigo mais perto, golpe 6 a cada 0,8 s, `hp 30`.
  - `cavaleiro`: investe em linha (como o `charger` dos inimigos, sem aviso) causando 8, `hp 22`.
  - `bandeirante`: fica atrás, atira (dano 4, 2/s, alcance 260), `hp 16`.
  - `capitu`: atira e cada acerto deixa o inimigo lento 1,5 s (dano 3, 2/s), `hp 16`.
  - `macunaima`: rápido (velocidade 220), corpo a corpo 5 a cada 0,5 s, `hp 18`.
  - `policarpo`: parado, leque de 5 a cada 1,2 s (dano 3), `hp 26`.
- Aliados somem quando o dono sai (`dead`) e na troca de andar (já acontece em `setupFloor`). Aliado nunca machuca jogador.
- [ ] **Step 1: Testes:** `inimigo mira no aliado com taunt mais perto`; `bala inimiga e contato tiram vida do aliado; aliado morre com hp 0`; `cada tipo novo causa dano num dummy em 3 s e nunca no jogador`; `aliado some quando o dono sai da partida` (marcar `p.dead = true`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: aliados com vida que atraem os inimigos`

### Task 6: Invocações — Exército Histórico (Felipe) e Clássicos Vivos (Tatiane)

**Files:**
- Modify: `shared/sim/personagens/skills.js`, `shared/sim/personagens/passives.js`, `client/src/render/propArt.js` (6 sprites), `client/src/render/SpriteFactory.js`, `client/src/render/WorldRenderer.js` (animação por tipo)
- Test: `test/professores.test.js`

**Interfaces:**
- `SKILLS.exercito_historico(world, p)`: cria `legionario`, `cavaleiro`, `bandeirante` em volta do jogador, `life` 10 s × `p.mods.allyLifeMul`.
- `SKILLS.classicos_vivos(world, p)`: cria `capitu`, `macunaima`, `policarpo`, `life` 10 s × `p.mods.allyLifeMul`.
- `p.mods.allyLifeMul` (padrão 1) também vale para a Planta da Vivian. Passivo `estrategista` (Felipe): `allyLifeMul = 1.5`.
- [ ] **Step 1: Testes:** `Exército Histórico invoca 3 soldados que duram 15 s com o Felipe`; `Clássicos Vivos invoca Capitu, Macunaíma e Policarpo por 10 s`; `invocações do Felipe atacam inimigos`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: Exército Histórico e Clássicos Vivos`

### Task 7: Habilidades de controle — Translate, Circuito, Terremoto/Vulcão, Obra-Prima (+ Paleta Viva)

**Files:**
- Modify: `shared/sim/personagens/skills.js`, `shared/sim/personagens/passives.js`, `shared/sim/inimigos/Enemy.js` (confusão), `shared/sim/combat.js` (circuito), `shared/sim/areas.js` (`painting`, `volcano`), `client/src/render/WorldRenderer.js`, `client/src/render/Effects.js`
- Test: `test/professores.test.js`

**Interfaces:**
- `translate` (Andréia, cd 14): inimigos não-chefe a até 180 px ganham `e.status.confused = 4`; chefes ficam lentos 2 s. Confuso: `nearestTarget` devolve o inimigo vivo mais próximo; balas que ele dispara saem com `team: 'player'`, `owner: null`; contato dele não fere jogadores e fere inimigos. Ícone "?" sobre o inimigo.
- `circuito` (Vinícius, cd 14): até 6 inimigos a até 220 px ganham `e.linked = { until: world.time + 6, id: castId }`. Em `damageEnemy`, dano (sem `opts.noChain`) num inimigo ligado repassa 50% para cada outro ligado do mesmo `id` com `noChain: true`. Linhas elétricas entre eles. Atualizar a descrição em `characters.json`: "Liga até 6 inimigos: cada um que leva dano repassa metade para os outros ligados."
- `terremoto` (William, cd 17): alterna a cada uso (`p.buffs.quakeNext` `'terremoto'`/`'vulcao'`). Terremoto: todos os inimigos da sala atual atordoados 1,5 s (chefes lentos) e 8 de dano; câmera treme. Vulcão: área `volcano` no ponto mirado (`aimPoint`, até 260 px) por 4 s que lança 3 bolas de lava/s em pontos aleatórios num raio de 90 px, cada uma com aviso `warn_circle` 0,4 s e dano 6 em inimigos. HUD mostra qual é o próximo.
- `obra_prima` (Gabriela P., cd 16): área `painting` raio 140 por 6 s no ponto mirado (até 200 px): inimigos dentro com velocidade × 0,3.
- Passivo `paleta_viva` (Gabriela P.): poças criadas por ela (`pool.ownerId === p.id`) e a `painting` ganham efeito aleatório `fogo`, `gelo` ou `veneno` (sorteado ao criar).
- [ ] **Step 1: Testes:** `Translate: inimigo confuso atira em outro inimigo e não no jogador`; `Translate sem inimigos perto não dá erro e entra em recarga`; `Circuito: dano em um repassa metade aos ligados`; `Terremoto atordoa e o próximo uso é Vulcão`; `Vulcão mirando parede cai antes da parede`; `Obra-Prima deixa inimigos muito lentos`; `Paleta Viva: poça da Gabriela P. tem efeito`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: Translate, Circuito, Terremoto/Vulcão e Obra-Prima`

### Task 8: Linha do Tempo, Reação em Cadeia e passivos que faltam

**Files:**
- Modify: `shared/sim/World.js` (histórico do time), `shared/sim/personagens/skills.js`, `shared/sim/personagens/passives.js`, `shared/sim/combat.js`, `shared/sim/personagens/Player.js` (regeneração de escudo por mod)
- Test: `test/professores.test.js`

**Interfaces:**
- `world.history`: a cada 0,1 s guarda `{ t, players: [{ id, x, y, hp, shield, downed }] }`, mantendo 3,2 s.
- `linha_do_tempo` (Gabriela S., cd 20): volta cada jogador vivo (não `dead`) para o registro de 3 s atrás (ou o mais antigo, se a partida tem menos de 3 s): posição, vida, escudo; quem estava de pé e agora está caído levanta (decisão do spec). Não volta inimigos. Evento `rewind` para o efeito (tela azulada).
- `reacao_em_cadeia` (Rosana, cd 16): `p.buffs.chainReaction = 6` s; enquanto ativo, cada inimigo que ela acerta (dano com `source === p`, sem `opts.noChain`) explode uma vez (`e.chainBoomed`) — raio 60, dano 6 — e a explosão faz os vizinhos atingidos também explodirem (uma vez cada).
- Passivo `alta_voltagem` (Vinícius): todo dano direto com `source` dele tem 15% de chance de aplicar `choque` (`chains 2, power 3`).
- Passivo `memoria_historica` (Gabriela S.): além do +1 de escudo atual, `p.mods.shieldRegenMul = 0.6` (atraso e intervalo de regeneração × 0,6). `Player.js` usa o mod.
- [ ] **Step 1: Testes:** `Linha do Tempo volta posição e vida de 3 s atrás`; `Linha do Tempo levanta colega que caiu nesses 3 s`; `Linha do Tempo no primeiro segundo não dá erro`; `Reação em Cadeia: um acerto derruba um grupo encostado`; `Alta Voltagem dá choque às vezes`; `Memória Histórica regenera escudo mais rápido`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: Linha do Tempo, Reação em Cadeia e passivos`

### Task 9: Liberar os 14 professores (dados, telas, online, visual)

**Files:**
- Modify: `shared/data/characters.json` (`playable: true` em todos), `client/src/scenes/CharacterSelectScene.js`, `client/src/scenes/LobbyScene.js`, `client/src/scenes/HudScene.js` (`SKILL_ICON` para as 8 habilidades novas; próximo Terremoto/Vulcão), `server/RoomManager.js`, `shared/net/snapshot.js` (`buffs.quakeNext`, `buffs.chainReaction`), `client/src/render/WorldRenderer.js` + `Effects.js` (visual das habilidades: confusão, elos, quadro pintado, vulcão, rebobinar, explosões em cadeia), `README.md`, `test/online.test.js` (o teste que espera `andreia` bloqueada passa a esperar `true`), `test/floors.test.js`, `scripts/smoke.mjs`
- Test: `test/professores.test.js`, `test/online.test.js`

**Interfaces:**
- Nenhum professor fica "Em breve"; telas sem cadeado; detalhe da seleção mostra arma inicial, habilidade e passivo de todos.
- `smoke.mjs`: cenário `professores` — para cada um dos 14, começa solo, usa a habilidade e atira 1 s; falha com erro no console.
- [ ] **Step 1: Testes:** `todos os 14 são jogáveis e têm habilidade implementada` (`SKILLS[c.skill.id]` existe e usar não dá erro num mundo com inimigos perto); `online: dois jogadores escolhem Andréia e William e a partida começa` (RoomManager); `snapshot leva quakeNext e chainReaction`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`; reiniciar o servidor; `node scripts/smoke.mjs` (inclui `professores` e `online`).
- [ ] **Step 5: Commit** — `feat: os 14 professores jogáveis`

---

## Etapa 5 — Dificuldade

### Task 10: Bot que joga partidas inteiras

**Files:**
- Create: `scripts/bot/bot.mjs`, `scripts/bot/run.mjs`
- Test: `test/bot.test.js`

**Interfaces:**
- `scripts/bot/bot.mjs` exporta:
  - `PROFILES = { dupla: {...}, experiente: {...} }` — cada perfil `{ reaction, aimError, dodge, keepRange, useSkill }`: `reaction` (s até reagir a uma bala que vem na direção dele), `aimError` (graus de erro de mira, aleatório), `dodge` (0–1, chance de desviar de cada bala perigosa), `keepRange` (distância preferida dos inimigos, px), `useSkill` (true/false). Os números iniciais são chute; a Tarefa 11 calibra.
  - `createBot(world, playerId, profile, rng): { think(dt): Input }` — `Input` no formato `{ moveX, moveY, aim, aimDist, fire, skill, interact, swap }` (compatível com a v0.2, que ignora `aimDist`).
  - `runMatch({ World, data, seed, players = 1, profile, maxSeconds = 1500, characterIds }): { victory, floor, seconds, reason }` — roda a partida a 60 passos por segundo sem tela. `reason`: `'victory' | 'defeat' | 'timeout' | 'stuck'`.
- Comportamento do bot (só usa a API pública do `World`, igual na v0.2):
  - Navegação por BFS no `world.map` (tiles não sólidos; portas trancadas contam como parede), recalculada a cada 0,25 s.
  - Prioridade de objetivo: lutar se há inimigos vivos na sala ativa → portal (se existe) → arma melhor no chão (raridade maior) → baú fechado → enfermaria com vida faltando → sala de combate `idle` mais perto → sala do chefe.
  - Luta: mira no inimigo mais perto com linha de visão (+ erro `aimError`), atira; mantém `keepRange` andando de lado; para cada bala inimiga a menos de `reaction × velocidade` px e indo na direção dele, com chance `dodge`, anda perpendicular à bala.
  - Co-op: cada bot independente; se um colega está caído e não há inimigos a menos de 200 px, vai até ele e fica parado sem atirar.
  - `stuck`: 20 s sem mudar de sala nem causar dano.
- `scripts/bot/run.mjs`: `node scripts/bot/run.mjs --root <pasta do jogo> --profile dupla --players 2 --runs 30 [--seed0 1]` importa `World` e `loadGameDataNode` de `<root>/shared/sim/` (permite rodar contra a v0.2 num worktree) e imprime a tabela: vitórias, andar médio alcançado, motivo de cada derrota, tempo médio.
- [ ] **Step 1: Teste** em `test/bot.test.js`: `bot termina um andar curto sem travar` (mundo com `roomCount: 2`, `maxFloors: 1`, perfil `experiente` com `useSkill: true`, `runMatch` com `maxSeconds: 240`; resultado `victory` ou `defeat`, nunca `stuck`/`timeout`; o teste deve rodar em menos de 20 s).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test` e `node scripts/bot/run.mjs --root . --profile experiente --players 1 --runs 3` (sem erro; imprime a tabela).
- [ ] **Step 5: Commit** — `feat: bot que joga partidas para calibrar a dificuldade`

### Task 11: Calibrar o bot "dupla do dono" na v0.2

**Files:**
- Modify: `scripts/bot/bot.mjs` (números dos perfis)
- Create: `docs/BALANCO.md`

**Interfaces:**
- Criar worktree da v0.2: `git worktree add /tmp/antares-v02 4a52203` (e `ln -s "$PWD/node_modules" /tmp/antares-v02/node_modules`). Não commitar nada lá.
- Ajustar `PROFILES.dupla` até: na v0.2, com 2 jogadores (`--players 2`), vencer **≥ 80%** de 30 partidas. Escolher o perfil **mais fraco** que ainda chega a 80% (spec 5.5: "o nível mais fraco que termina a v0.2 de forma confiável").
- `PROFILES.experiente`: reação e mira claramente melhores que `dupla` (ex.: metade do `reaction` e do `aimError`, `dodge` maior).
- `docs/BALANCO.md`: perfis finais, tabela v0.2 (dupla 2 jogadores, dupla 1 jogador, experiente 1 e 2 jogadores) com vitórias/30, andar médio e motivo das derrotas, e o comando para repetir.
- [ ] **Step 1:** criar o worktree e rodar `node scripts/bot/run.mjs --root /tmp/antares-v02 --profile dupla --players 2 --runs 30`.
- [ ] **Step 2:** ajustar `PROFILES.dupla` e repetir até o alvo; registrar cada rodada no `BALANCO.md`.
- [ ] **Step 3:** rodar e registrar `experiente` na v0.2.
- [ ] **Step 4:** `npm test`.
- [ ] **Step 5: Commit** — `docs: calibração do bot na v0.2`

### Task 12: Dificuldade da v0.3 calibrada

**Files:**
- Modify: `shared/data/enemies.json`, `shared/sim/constants.js` (`SHIELD_REGEN_DELAY`), `shared/sim/inimigos/Enemy.js` (escala por jogador nos inimigos comuns), `shared/sim/salas/RoomDirector.js` (ondas e recompensas), `shared/sim/salas/Pickups.js` (preços, cura), `shared/sim/inimigos/chefes/*.js` (dano/velocidade, se necessário), `docs/BALANCO.md`, testes que dependem de números
- Test: os existentes; `test/bot.test.js`

**Interfaces (alavancas do spec 5.5; números com o executor):**
- Dano: ataques fortes (régua, apontador, explosões, investida do grampeador, mochila) e chefes tiram 2; no andar 3, mais ataques tiram 2 (`attack.damage` por inimigo; chefes nos arquivos de `chefes/`).
- Balas mais rápidas (+15–25%), mais inimigos por onda, `eliteChance` e `hpScale` maiores nos andares 2 e 3.
- Chefes com mais vida e ataques mais frequentes.
- Escala por jogador nos comuns: por jogador extra, +40% de inimigos por onda (hoje +1 por jogador) e +25% de vida.
- Cura mais rara: maçã do chão (drop de sala 25% → 12%), maçã da loja 3 → 2 de vida, enfermaria cura menos (metade da vida máxima, não tudo), preços da loja e da estátua +30%.
- `SHIELD_REGEN_DELAY` 4 → 5.
- **Alvos (spec 5.5), 30 partidas por linha, na v0.3:** `dupla` com 2 jogadores vence **5–15%**, e morre em geral no andar 2 ou no chefe do andar 3; `dupla` com 1 jogador também 5–15%; `experiente` (1 e 2 jogadores) vence **25–40%**.
- [ ] **Step 1:** rodar a tabela na v0.3 atual (antes de mexer) e registrar no `BALANCO.md`.
- [ ] **Step 2:** mexer nas alavancas e repetir até os alvos; registrar cada rodada (o que mudou, resultado).
- [ ] **Step 3:** ajustar testes que dependem de números (sem enfraquecer o que eles verificam).
- [ ] **Step 4:** `npm test`; reiniciar o servidor; `node scripts/smoke.mjs`.
- [ ] **Step 5: Commit** — `feat: dificuldade calibrada por bots`

### Task 13: Verificação final e documentação

**Files:**
- Modify: `README.md` (versão 0.3: inimigos, 14 professores, dificuldade, bot), `docs/BALANCO.md` (como recalibrar depois que o dono jogar)

- [ ] **Step 1:** `npm test` → tudo passa.
- [ ] **Step 2:** reiniciar o servidor; `node scripts/smoke.mjs` → todos `ok`.
- [ ] **Step 3:** `node scripts/bot/run.mjs --root . --profile dupla --players 2 --runs 30` → dentro do alvo da Tarefa 12.
- [ ] **Step 4:** remover o worktree da v0.2 (`git worktree remove /tmp/antares-v02`).
- [ ] **Step 5: Commit e push** — `docs: v0.3 completa` e `git push -u origin claude/v0.3-armas-inimigos`.
