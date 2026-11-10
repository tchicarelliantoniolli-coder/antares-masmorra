# Passagem de trabalho (HANDOFF)

Escrito em 10/11/2026 para que outra IA (ou pessoa) continue de onde parei. Leia este arquivo inteiro antes de mexer em qualquer coisa.
O dono do jogo fala português do Brasil, gosta de respostas curtas e de resultados que ele consiga jogar logo.

## 1. O que é o projeto

**Antares: A Masmorra Escolar** é um roguelike de tiro com visão de cima, tema escola, para jogar sozinho, em dupla no mesmo
computador (até 4 controles) ou online com salas. Phaser 3 no navegador e Node/Express/Socket.io no servidor.
A lógica do jogo fica em `shared/sim/` (sem Phaser) e roda igual no navegador e no servidor autoritativo (online a 60 Hz,
snapshots a 20 Hz). O mapa de estrutura do código está no [README.md](README.md).

Regras que valem para qualquer mudança (vêm do dono e do design):

- A simulação não pode depender do Phaser. Tudo que o renderizador desenha precisa estar no snapshot (`shared/net/snapshot.js`)
  ou ser derivável do mapa e das salas serializados, e tem que ficar igual online.
- Todo ataque perigoso de inimigo tem aviso visível antes do dano.
- Números e conteúdo ficam em JSON editável (`shared/data/*.json`). Sprites são gerados por código, com chave substituível.
- Textos do jogo em português do Brasil, tema escolar, nada copiado de outro jogo.
- O jogo precisa ser **difícil**: só bons jogadores terminam. O dono e um amigo zeraram a v0.2 (3 andares) de primeira em dupla;
  a v0.3 não pode ser vencida de primeira por eles. Ver [docs/BALANCO.md](docs/BALANCO.md).

## 2. Estado dos branches (leia primeiro)

| Branch | O que tem | Situação |
|---|---|---|
| `main` | v0.3.1 (commit `6b07b4d`): v0.3 completa + armas rebalanceadas + drops sem repetição | publicada |
| `claude/v0.4-salas-vivas` | tudo da `main` + v0.4 (salas com vida) + este arquivo | testada, **ainda não foi juntada na `main`** |

A v0.4 só deve ir para a `main` depois do aval do dono (ele não jogou ainda). Para juntar:

```bash
git checkout main && git pull origin main
git merge claude/v0.4-salas-vivas
npm test                    # esperado: 193 testes, 0 falhas
git push origin main
```

## 3. O que foi feito

### v0.2 (base, commit `4a52203`)
3 andares, 6 professores, co-op local, online com salas, mapas no estilo Soul Knight. Foi a referência de dificuldade
(o robô de balanceamento foi calibrado contra ela).

### v0.3 (branch `claude/v0.3-armas-inimigos`, já na `main`)
Pedido do dono: todos os professores no jogo, jogo muito mais difícil, armas com mecânicas diferentes (como no Soul Knight),
bug do menu, inimigos que não façam todos a mesma coisa, reviver o colega.

- **Menu:** corrigido o bug em que o menu parava de aceitar cliques depois de sair e voltar (`MenuScene`, `LobbyScene`).
- **Reviver:** o caído levanta se o colega ficar parado, sem atirar, a 5 s dele (`REVIVE_TIME`); também levanta no andar seguinte, depois do portal.
- **Armas:** 53 armas em 14 modos (tiro, rajada, carregar, aquecimento, laser, lança-chamas, arremesso, divide, cadeia, colocar no chão, singularidade, chuva, órbita, variantes) e 4 estilos de corpo a corpo (golpe, estocada, combo, escudo). Tudo por JSON; guia em [docs/ARMAS.md](docs/ARMAS.md). `scripts/weapon-dps.mjs` confere o dano por segundo de cada arma por faixa de raridade.
- **Inimigos:** cada um tem comportamento próprio, com aviso (linha ou círculo) antes do golpe: perseguidor, atirador, leque, torreta, anel, kamikaze, que se divide, investida, atirador de longe, que se enterra, invocador, que dá escudo, que teletransporta. Elites com modificadores (rápido, blindado, explosivo, vampiro, duplicador). Ondas montadas por função (`role`).
- **14 professores jogáveis**, cada um com habilidade e passivo: aliados com vida que atraem inimigos, invocações, Translate (confusão), Circuito (elo), Terremoto/Vulcão, Obra-Prima, Linha do Tempo (volta 3 s), Reação em Cadeia etc. Nada mais aparece como "Em breve".
- **Dificuldade calibrada por robô:** `scripts/bot/bot.mjs` e `run.mjs` jogam partidas inteiras sem tela. Perfil `dupla` = jogadores medianos (vence 80% da v0.2 com 2 jogadores); perfil `experiente` = jogadores bons. Alavancas em `shared/data/enemies.json` (`difficulty` e `floors`). Rodadas e resultados em [docs/BALANCO.md](docs/BALANCO.md).
- Revisões por tarefa e uma revisão final acharam e corrigiram, entre outros: Linha do Tempo jogava o time para fora de sala trancada, filhos da borracha nasciam na parede, escudo do Grêmio quebrava o Estojo, crash da Samara (existia desde a v0.2: `choose()` zerava todos os pesos).

### v0.3.1 (branch `claude/v0.3.1-armas-drops`, já na `main`)
Pedido do dono: armas roubadas (sino roxo = Sinal do Recreio matava o chefe rápido demais encostado) e drops repetidos/sem novidade.

- `projectile.sharedHit`: o anel do Sinal do Recreio e as flechas do Arco de Régua acertam cada inimigo uma vez por disparo (antes, encostado num chefe, as 13 ondas acertavam juntas: ~196 de dano/s contra teto de 30).
- `weapon-dps.mjs` agora mede também a arma **encostada** num alvo do tamanho de um chefe e falha acima de 1,5× o teto da faixa. Ajustados: Escopeta, Canhão de Confete, Bico de Bunsen, Extintor, Arco de Régua.
- Drops: as armas não se repetem na partida (baú, loja, chefe, inimigo, sala; também pula as que estão na mão). Nova alavanca `difficulty.roomWeaponChance` (0,35): chance de arma ao limpar sala de combate.

### v0.4 (branch `claude/v0.4-salas-vivas`, **não juntada**)
Pedido do dono: "as salas estão muito sem vida e todas iguais".

- **Formas de sala** (só combate): retângulo, cantos cortados, L, cruz, T (`shared/sim/salas/formas.js`, `r.shape` no snapshot).
- **Layouts temáticos** (`layouts.js`): carteiras, carteiras em U, bancadas, ilhas, estantes, quadra, canteiros, mesas longas, sala dupla, mais os geométricos antigos. Cada tema escolhe os seus por peso.
- **Objetos quebráveis por tema** (mochila, pilha de livros, caixa de tubos, cesto de bolas, vaso, pilha de papéis, bandeja) e **decoração de parede** nova (lâmpada, bandeira, extintor, mapa-múndi, troféus, quadro de avisos). Salas especiais (início, baú, enfermaria, estátua, chefe) mobiliadas.
- **Arte** (`client/src/render/`): sombras de parede e de contato, pisos com mais variantes, obstáculos A/B, decalques de chão determinísticos (tapete, giz, papéis, poças, linhas da quadra, amarelinha, folhas...) em `decals.js`.
- **Atmosfera** (`Atmosphere.js`): luz ambiente por tema e por andar (andar 1 dia quente, 2 fluorescente frio, 3 entardecer vermelho) feita com cor por vértice no tilemap do chão (não escurece inimigos, balas nem avisos), feixes de sol nas janelas, partículas por tema (poeira, bolhas, folhas, vapor, papéis, brasas; **desligadas em sala de chefe** para não parecerem as balas do Xerox e da Samara), lâmpadas de laboratório que piscam, vinheta.
- **Dados:** `shared/data/themes.json` (por tema: layouts, objetos, decoração, luz, partículas, decalques; e `shapes`) validado ao carregar (`validateThemes` em `shared/sim/data.js`); nomes oficiais em `shared/sim/salas/kinds.js`. Guia em [docs/SALAS.md](docs/SALAS.md).
- Testes novos: `test/rooms.test.js` (portas, baús, estátua, enfermaria, loja e portal alcançáveis em todos os temas × formas × andares; sem pinças; determinismo).

## 4. Como rodar e conferir

```bash
npm install
npm start                                   # servidor em http://localhost:3000 (PORT=3000 por padrão)
npm test                                    # node --test; esperado na branch v0.4: 193 ok
node scripts/weapon-dps.mjs                 # esperado: "53 armas, 0 fora da faixa, 0 roubadas encostado"
node scripts/smoke.mjs                      # navegador (Playwright); servidor PRECISA estar rodando com o código atual
node scripts/bot/run.mjs --root . --profile dupla --players 2 --runs 30 [--seed0 31] [--set reaction=0.5,aimError=14]
```

Armadilhas que já me custaram tempo:

- **Reinicie o servidor antes do `smoke.mjs`** (`pkill -f "node server/index.js"; PORT=3000 node server/index.js &`): servidor velho = teste antigo.
- A `GameScene` sempre cria o andar 1; para ver os andares 2 e 3 numa captura, chame `world.setupFloor(n)` pelo `page.evaluate` (`window.__game.scene.getScene('Game').world`).
- Um teste de fumaça do `professores` falhou uma vez com a Marina quando dois smokes rodavam juntos (arma de carga só atira ao soltar). Não rode dois ao mesmo tempo.
- Ao mexer em `scripts/weapon-dps.mjs`, lembre que a sala de teste precisa ficar vazia (limpar paredes internas das formas novas).
- Depois de mudar sim ou dados, rode o robô de novo: salas, inimigos e armas mexem na dificuldade.

## 5. O que ainda precisa ser feito

### A. Decisões do dono
1. **Juntar a v0.4 na `main`** (comandos na seção 2). Ele ainda não jogou as salas novas. Recomendo ele jogar o branch antes.
2. Dificuldade do "experiente": na v0.4 ele vence 13% jogando sozinho (meta 25–40%; era ~26% na v0.3) e 37% em dupla. Parte vem de partidas em que o robô fica "preso" (7 em 30), porque ele não persegue atiradores escondidos em braços das formas T/cruz nem o Caderno Preto invulnerável como um jogador faria. Só vale recalibrar depois que o dono (e o amigo) jogarem de verdade. Se ficar difícil demais, alivie os pesos dos layouts densos em `themes.json` (carteiras, estantes, mesas_longas, bancadas).
3. A "dupla" solo vence 0% (na v0.2 já era 3%): aceito, porque o dono joga em dupla.

### B. Pendências da revisão da v0.4 (todas pequenas)
- Objeto `mochila` tem silhueta parecida com o inimigo Mochila-Bomba (cores diferentes): deixar mais baixa/"deitada".
- `client/src/render/Atmosphere.js` (~850 linhas): dividir em luz e partículas. `instalarChao` troca o `renderWebGL` de objetos pela faixa de depth; é frágil a um upgrade do Phaser (`^3.90.0`): fixar a versão ou marcar os objetos de chão explicitamente.
- `decals.js` `doorZone` duplica `reservedSet` de `layouts.js` (exportar uma versão com parâmetro).
- `RoomDirector.js` `freeCells`: o fallback devolve células inalcançáveis no caso degenerado.
- `formas.js` `applyShape` devolve um `n` que ninguém usa. `Effects.js`: todo objeto quebrado solta a mesma lasca marrom de caixa.
- Fallback Canvas do Phaser não escurece o chão (feixes e partículas funcionam).
- `client/assets/sprites/LEIA-ME.md` está desatualizado (fala de tileset 256x224 e não cita `shadows`).
- Decalques ficam abaixo das sombras (depth 0,4 contra 0,5) de propósito; arena do chefe ficou livre (só pilares), sem objetos nas laterais; enfermaria usa bancadas em vez de macas.
- `setupShop`: o balcão em `y0+3` pode cruzar a boca de uma porta norte (já existia antes).

### C. Pendências deferidas da v0.3 (todas pequenas; ver lista completa no Apêndice B)
Principais: laser apertado repetidamente bate mais que segurado; estocada continua um passo depois de trocar de andar; trocar de arma no meio da rajada pula a recarga; invocações sem checar linha de visão; áreas, raios e golpes de chefe não ferem aliados; confusão não cobre o Caderno Preto, kamikaze e balas explosivas; Samara (480 de vida) quase igual à Katia (470); preços ×1,3 da loja não foram medidos (o robô não compra).

### D. Ideias que o dono pode querer depois
- **Modificadores de sala** (sala escura, chão escorregadio, sala com evento): a v0.4 só mexeu em forma, mobília e visual, nada de regra nova.
- Salas especiais com formas diferentes (hoje são sempre retângulos) e salas de chefe com arena própria por tema.
- Teste online com 2 jogadores olhando as salas novas lado a lado (o smoke online passa, mas ninguém comparou as telas).

## 6. Convenções do repositório

- Branches `claude/<versão>-<tema>`; commits pequenos, em português, no estilo Conventional Commits (`feat:`, `fix:`, `docs:`), terminando com a linha `Co-Authored-By` do seu modelo e a linha `Claude-Session` da sua sessão.
- Não faça push na `main` sem o aval do dono; abra um branch, mostre o resultado e pergunte.
- Mudanças grandes funcionaram bem assim: primeiro um **contrato de dados** (`themes.json` + `kinds.js`), depois agentes em paralelo cada um dono de uma pasta (gerador, arte, atmosfera), e por fim uma revisão do conjunto antes de juntar.
- Toda mudança em armas: rode `weapon-dps.mjs`. Em inimigos, salas ou dificuldade: rode o robô (60 partidas na linha da dupla) e registre em `docs/BALANCO.md`.
- `graphify-out/` (mapa de conhecimento do código) é local e fica fora do git; não faz parte do jogo.

## 7. Mapa dos documentos

| Arquivo | Para quê |
|---|---|
| `README.md` | visão geral, como jogar, estrutura do código |
| `docs/ARMAS.md` | criar armas pelo JSON (modos, estilos, campos) |
| `docs/SALAS.md` | formas, layouts, `themes.json`, como criar sala ou tema |
| `docs/BALANCO.md` | calibração por robô, resultados de cada rodada, como recalibrar |
| `docs/superpowers/specs/2026-11-05-armas-inimigos-professores-dificuldade-design.md` | desenho aprovado da v0.3 (autoridade) |
| `docs/superpowers/plans/*.md` | planos executados da v0.3 |

---

## Apêndice A — Decisões que tomei pelo dono (v0.3)

Cada linha: a decisão, o motivo e o custo se estiver errada. O dono ainda não revisou esta lista.

### Plano 1 (armas, menu, revive)
- T3→T4..T11: normalizeWeapon fills w.mode, w[mode], melee.style, w.melee[style]? Plan lists thrust/combo/shield defaults under "melee extra" — Ruling: store as w.melee.thrust / w.melee.combo / w.melee.shield (nested in melee block) — keeps JSON melee config in one block — cost if wrong: rename later.
- Task 3: Ruling: estilos de melee ficam em w.melee.<estilo> (ex.: melee.combo) — mantém config de melee num bloco — custo: renomear no JSON
- Task 4: Ruling: tryPay/startCooldown/energyCost/emitShoot ficam em armas/common.js e Weapons.js reexporta — evita import circular Weapons↔modes — custo: nenhum (interface igual)
- Task 4: Ruling: helpers de teste (dummy, withWeapon, arena) em test/helpers.js, não em weapons.test.js — importar arquivo de teste rodaria os testes dele de novo — custo: nenhum
- Task 4: Ruling: spawnShot com countOverride>1 e spread 0 usa leque de 24° — para fullCount do charge não sair tudo no mesmo ângulo — custo: ajuste de número
- Task 4: Ruling: smoke.mjs ganhou cenário partida-solo (segura tiro 1 s no navegador) — refatoração do disparo precisava de checagem real no cliente — custo: nenhum
- Task 5: Ruling: variantes ganham spriteKey proj_<id>_v<i> (normalizeWeapon) — cada variante precisa de sprite próprio no render — custo: SpriteFactory precisa gerar essas chaves (T12)
- Task 5: Ruling: filhos do split saem na direção refletida (parede) ou na direção do voo (inimigo), 6 px para fora; alcance = 60% do que faltava (mín. 120) — spec não fixa — custo: ajuste de número
- Task 5: Ruling: área gravity agora também causa dano no centro (antes pulava d<4) — mesma área serve gravity e singularity — custo: Campo Gravitacional um pouco mais forte
- Task 6: Ruling: beam emite 'shoot' a cada tique (10/s) para estatística e som; Effects precisa limitar o som do laser (T12) — custo: som repetitivo se esquecer
- Task 7: Ruling: rain ganhou maxRange (padrão 380) — o plano não dizia até onde a chuva alcança — custo: ajuste de número
- Task 7: Ruling: chain escolhe o inimigo com menor diferença de ângulo até a mira (dentro do cone, com visão) — "mais próximo da mira" ambíguo — custo: escolha diferente em grupos
- Task 7: Ruling: lob sem explosão causa dano em quem está embaixo ao cair (raio do projétil + 8) — senão catapulta sem explode não faria nada — custo: nenhum
- Task 7: Ruling: chainShock (efeito choque) passou a usar chainFrom e ignora inimigos invulneráveis — reaproveita código — custo: nenhum
- Task 8: Ruling: resetWeaponState(p, world) ganhou "world" opcional para lançar órbitas — interface do T4 não tinha world — custo: nenhum
- Task 8: Ruling: minas não são acionadas por inimigos voadores; órbitas somem se o dono cair — fazem sentido no tema — custo: ajuste de regra
- Task 9: Ruling: golpe final do combo tem recarga 1,3× — dá peso ao 3º golpe — custo: ajuste de número
- Task 9: Ruling: escudo bloqueia antes da checagem de invulnerabilidade (gasta energia mesmo invulnerável) — bloqueio é do escudo, não do corpo — custo: energia gasta à toa logo após levar dano
- Task 11: Ruling: 53 armas (28 + 8 iniciais novas + 17 novas), sem cortar — spec diz "cerca de 50" e todas passaram na faixa — custo: mais armas para balancear
- Task 11: Ruling: damageEnemy ganhou opts.carry (fração acumulada por inimigo) para laser/poça/campo — arredondar 1,4→1 tirava ~30% do dano do laser — custo: nenhum
- Task 11: Ruling: poças do mesmo dono e estilo não somam dano (1 pulso por 0,45 s por inimigo) — cada tiro do pincel deixa uma poça; somando, o pincel dava 22 dano/s — custo: poças de jogadores diferentes ainda somam
- Task 11: Ruling: órbita lança os projéteis convergindo para o ponto mirado (não em paralelo) — em paralelo erravam alvo pequeno (4,5 dano/s) — custo: nenhum
- Task 11: Ruling: anel 360° (Sinal do Recreio) conta como arma de área no script de dano/s (pode ficar 30% abaixo) — acerta muitos ao mesmo tempo — custo: fraco contra alvo único
- Task 11: Ruling: smoke.mjs ganhou cenário galeria (gera todos os sprites) — conferir desenhos novos — custo: nenhum
- Task 12: Ruling: sons novos reaproveitam os do sintetizador (equation, shield_hit, boss_dash, crate...) em vez de criar timbres — evita mexer no Sound.js — custo: sons menos característicos
- Task 12: Ruling: card da arma troca a linha "Imprecisão" por "Modo" — card tem altura limitada — custo: imprecisão some do card
- Task 12: Ruling: capturas do smoke vão para a pasta de --shots (scratchpad), não para o repositório — custo: nenhum
- Task 13: Ruling: cenário online usa Jean Paulo (laser) e Marina (carga) em vez de laser+arremesso — arma de arremesso inicial é de professor ainda bloqueado e o servidor decide as armas — custo: arremesso online coberto só pelo teste de snapshot
- Final: Ruling: Minor 2 (órbitas ativas com jogador assinando/preso) → Important — item 3 do Review Focus do plano; Andréia (órbita) liberada na Etapa 4 — custo: nenhum
- Final: Ruling: Minor 5 (globo não cresce na tela) → Important — descrição promete "volta 50% maior"; William liberado na Etapa 4 — custo: nenhum
- Final: Ruling: Minor 7 (estilingue ricocheteia sempre; boliche sem empurrão) → Important — requisito explícito da tabela do spec 5.2 — custo: nenhum
- Final: Ruling: Minor 8 (deploy.max 0 trava) → Important parcial (só max>=1) — restrição global "erros de dados legíveis" — custo: nenhum
- Final: Ruling: Minor 6 (Bilíngue só no tiro normal) → vai para a Tarefa 8 do plano 3–5 (passivos) — Andréia ainda bloqueada; passivos são escopo da Etapa 4 — custo: esquecer → ponteiro registrado no ledger do plano 3–5
- Final: Ruling: Declined "inimigos atacam torretas/minas como isca" — já coberto pela Tarefa 5 do plano 3–5 (taunt) — custo: nenhum
- Final: Ruling: Declined "invulnerabilidade da estocada ~22–45%" — balanceamento, Tarefa 12 do plano 3–5 — custo: nenhum
- Final: Ruling: demais itens de "Declined to judge" ficam como estão (arte da chuva, menu fecha carga online, Raio-X atravessa parede por spec, mesma arma nos dois slots, volume de eventos do laser, confirm sem guarda) — efeito pequeno ou previsto no spec
- Final: Ruling: commits do fix pass com trailer "Claude Sonnet 5.5" (modelo real do subagente) mantidos — reescrever exigiria force-push de commits já enviados — custo: atribuição diferente nesses 8 commits
- Final: Ruling: escolha autoDist vs DEFAULT_AIM_DIST dentro de Controller.poll sem teste unitário (arquivo não importa no Node); a parte pura (aim.js) testada — custo: regressão no poll só aparece jogando

### Plano 2 (inimigos, professores, dificuldade)
- T7↔T8 | circuito, reação em cadeia e alta voltagem mexem em damageEnemy | Ruling: opts.noChain marca todo dano secundário (repasse do circuito, explosão da reação, choque) — evita laço infinito entre os três — custo: combos menores |
- T2 | prova voadora sem aviso explícito | Ruling: windup já pisca vermelho no render (aviso visível) — conta como aviso — custo: nenhum |
- Task 11: Ruling: calibrar na v0.2 com o guard do choose() da Samara (cópia /tmp/antares-v02fix) é o critério aceito — os donos não morreram por crash; registrar os dois números
- Task 12: Ruling: dupla 1p 0% aceito (v0.2 já era 3%; dono joga em dupla; alvo de 2p e experiente priorizado)
- Task 13: Ruling: apagar /tmp/antares-v02fix está ok (cópia descartável da Tarefa 11, só com o guard da Samara)
- Task 13: Ruling: experiente fora da faixa nas seeds novas (1j 20%, 2j 57%; ~26%/~44% em 90 jogos) aceito sem novo ajuste — alvo principal (dupla 2j ~7%) se mantém
- Final review: Ruling: minors deferidos restantes (ambos os ledgers) ficam, conforme a triagem do revisor final; T8 jail/dash/pull entra no fix do Critical

## Apêndice B — Pequenos problemas deixados para depois (v0.3)
- Final: minor (deferred): laser apertado repetidamente bate mais que segurado (idle zera beamT) — só com macro
- Final: minor (deferred): estocada continua 1 passo depois da troca de andar (p.dash não zera em completeFloor)
- Final: minor (deferred): trocar de arma no meio da rajada pula a recarga (+24–40% dano/s com Q repetido)
- Final: minor (deferred): variants.list sem checagem de campo desconhecido; sem checagem de faixa em durações
- Final: minor (deferred): GameScene events.on('resume') acumula listener (idempotente)
- Final: minor (deferred): armas de teste (withWeapon) entram no sorteio de drops dentro do arquivo de teste
- Final: minor (deferred): raio congela na tela durante o fade de vitória
- Final: minor (deferred): rodapé do menu ainda diz v0.2
- Task 3: minor (deferred): limite de 6 invocados é por monitor (2 monitores = 12)
- Task 3: minor (deferred): aviso do sniper com comprimento fixo atravessando parede (o do grampeador para na parede)
- Task 3: minor (deferred): banner de comentário "Projéteis" fora do lugar em enemyArt.js; behaviors.js ~530 linhas
- Task 4: minor (deferred): evento enemy_heal do vampiro sem efeito visual/sonoro
- Task 4: minor (deferred): explosão do elite explosivo também fere inimigos (brief: "dano 2 no jogador")
- Task 4: minor (deferred): vampiro só cura com balas de enemyShoot (spawnProjectile direto não marca shooter)
- Task 4: minor (deferred): coverRoles troca depois de sortear (rng extra); affixes.js ↔ Enemy.js import circular preguiçoso
- Task 4: minor (deferred): teste do duplicador não exercita o recuo para a posição do original
- Task 5: minor (deferred): áreas, raios e golpes de chefe não ferem aliados (só contato, balas e explosões)
- Task 5: minor (deferred): linha de assert morta em test/professores.test.js (capitu); a.flash do aliado não é desenhado
- Task 6: minor (deferred): invocação sem checar linha de visão (pode nascer atrás de parede fina); sem teste de ataque dos Clássicos Vivos; comentários de skills.js desalinhados/obsoletos
- Task 7: minor (deferred): repasse do circuito arredonda para no mínimo 1 (golpe de 1 repassa 1 inteiro); usar carry
- Task 7: minor (deferred): confusão não cobre capturer (Caderno Preto), explosões de kamikaze e balas explosivas do próprio confuso
- Task 7: minor (deferred): Paleta Viva sobrescreve efeito já existente da poça; imports no meio do test/professores.test.js
- Task 8: minor (deferred): ticks de DoT (queimadura/veneno, poça, gravidade) disparam Alta Voltagem/Reação a cada tick (sem noChain)
- Task 8: minor (deferred): Linha do Tempo teleporta sem checar cela (jailTimer)/dash/puxão
- Task 8: minor (deferred): faltam testes de chainBoom (chefe, noChain, vizinho morto) e Bilíngue só testado em órbita; linha morta `const longe` no teste
- Task 9: minor (deferred): smoke professores não reseta def do alvo entre professores; tabela do README não conferida contra characters.json
- Task 10: minor (deferred): teste do bot só 1 seed/1 jogador (sem co-op/revive); fórmula de aimError não é exatamente "graus"
- Task 10: minor (deferred): fallback da Samara restaura pesos sem reaplicar guardas (caderno vivo / ninguém livre); médias NaN se 0 válidas
- Task 11: minor (deferred): --set aceita chave desconhecida/NaN; comentário duplicado em bot.mjs; margem de 80% fina (24/30, penhasco em dodge 0.55→0.6)
- Task 12: minor (deferred): teste da Samara não cobre o fix de forma determinística; seeds 31-60 não são held-out (rodar 61-90 na T13)
- Task 12: minor (deferred): Samara 480 ≈ Katia 470 de vida; preços ×1.3 não medidos (bot não compra); bulletSpeedMul vaza para balas de inimigo confuso; ramo duplicado shop_item/statue em Pickups.js; assert fraco no teste da enfermaria
- Task 13: minor (deferred): causa do flake da Marina no smoke não confirmada (provável navegador lento com smokes sobrepostos)


## Apêndice C — Decisões que tomei pelo dono (v0.3.1 e v0.4)

- Armas: o anel e as flechas passam a acertar cada inimigo uma vez por disparo (`sharedHit`) em vez de só cortar o dano — mantém o anel forte contra grupos e tira o abuso encostado no chefe. Custo se estiver errada: o Sinal do Recreio fica menos "explosivo" de perto.
- Armas: limite de 1,5× o teto da faixa quando encostado num chefe (`PB_MAX` em `weapon-dps.mjs`) — número meu. Custo: ajuste de número.
- Drops: 35% de arma ao limpar sala de combate (`roomWeaponChance`) e sorteio sem repetir na partida — número meu. Custo: partidas ficam mais fáceis com mais armas; é só baixar o número.
- Salas: só as de combate ganham forma; início, baú, enfermaria, estátua, loja e chefe continuam retangulares (chefes têm ataques que usam a sala inteira). Custo: salas especiais menos variadas.
- Salas: partículas desligadas em sala de chefe (papéis e brasas imitavam as balas do Xerox e da Samara). Custo: arenas de chefe com menos clima.
- Salas: luz feita por cor de vértice só no chão, em vez de uma camada escura por cima de tudo (a camada custou +17 ms por quadro). Custo: no fallback Canvas o chão não escurece.
- Dificuldade: depois das salas novas não recalibrei os bots (dupla 2 jogadores ~5%, experiente 13% solo e 37% em dupla); decidi esperar o dono jogar. Custo: o "experiente" solo está abaixo da meta de 25–40%.
