# Etapas 1 e 2 (menu, revive, sistema de armas) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o menu que trava, trocar o revive do co-op e refazer as armas com mecânicas diferentes (laser, carregar, rajada, arremesso, torreta, combo...), chegando a cerca de 50 armas.

**Architecture:** Cada mecânica é um "modo" escrito uma vez em `shared/sim/armas/` e escolhido por arma no `weapons.json` (`mode` para tiro, `melee.style` para corpo a corpo). Um despachante (`updateWeapon`) roda todo passo com o input (segurando/soltou) e chama o modo. Estado novo (raios, carga, escudo, altura de arremesso) entra no snapshot online e no renderizador.

**Tech Stack:** JavaScript ES modules, Phaser 3 (cliente), Node 18+ (`node --test`), Socket.io, Playwright (já instalado na máquina, só para o teste de fumaça no navegador).

**Spec:** `docs/superpowers/specs/2026-11-05-armas-inimigos-professores-dificuldade-design.md` (seções 5.1 e 5.2). As etapas 3, 4 e 5 terão planos próprios, escritos depois desta, porque usam as interfaces criadas aqui.

## Global Constraints

- Lógica de jogo só em `shared/sim/`, sem Phaser; roda igual no navegador e no servidor.
- Tudo que o renderizador desenha precisa ir no snapshot (`shared/net/snapshot.js`) e funcionar no modo online.
- Criar arma nova continua sem programar: só `shared/data/weapons.json`; erros de dados aparecem na tela de carregamento e no `npm test`.
- Arma sem `mode` funciona exatamente como hoje (`shot`); melee sem `style` funciona como hoje (`swing`).
- Todas as armas iniciais custam 0 de energia.
- Textos do jogo em português do Brasil; nomes e visual com tema escolar, sem copiar nomes/arte de outro jogo.
- Todo ataque perigoso de inimigo tem aviso visível (vale para as etapas seguintes; aqui, minas e chuva também mostram aviso).
- `npm test` passa ao fim de cada tarefa.
- Commits pequenos no branch `claude/v0.3-armas-inimigos`, mensagens em português, terminando com as linhas de atribuição da sessão.

## Review Focus

1. **Trocar ou pegar arma no meio de uma ação** (carregando, laser ligado, escudo levantado, rajada em andamento, órbita cheia): o estado da arma anterior some; nada dispara de graça. Teste na Tarefa 4.
2. **Energia acabando enquanto segura** um modo contínuo (`beam`, `flame`, `spinup`): para de atirar, avisa `no_energy`, energia nunca fica negativa. Teste na Tarefa 6.
3. **Jogador cai, é preso (Suspensão) ou fica "assinando" no meio de carga/escudo/estocada/órbita**: estados limpos, estocada não atravessa parede. Teste na Tarefa 9.
4. **Troca de andar com coisas ativas** (raios, arremessos no ar, minas, torretas, órbitas, poças): tudo some, sem erro. Teste na Tarefa 8.
5. **Input ruim vindo da rede** (`aimDist` `NaN`, negativo, enorme, ou ausente em cliente antigo): sanitizado para um valor válido, sem erro. Teste na Tarefa 4.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `client/src/scenes/MenuScene.js`, `LobbyScene.js` | (Etapa 1) resetar estado da cena em `create()` |
| `shared/sim/constants.js` | `REVIVE_TIME = 5`, `DEFAULT_AIM_DIST = 220`, `MAX_AIM_DIST = 1200` |
| `shared/sim/personagens/Player.js` | revive novo; guarda `aimDist`, `firing`; chama `updateWeapon`; estocada (`p.dash`); limpeza ao cair/preso |
| `shared/net/InputBuffer.js` | sanitiza `aimDist` |
| `client/src/input/Controllers.js`, `client/src/net/OnlineSession.js` | produzem e enviam `aimDist` |
| `shared/sim/data.js` | listas de modos/estilos, padrões por modo, validação, `MODE_LABELS` |
| `shared/sim/armas/Weapons.js` | despachante `updateWeapon`, `energyCost`, `tryPay`, reset de estado |
| `shared/sim/armas/shots.js` (novo) | `spawnShot`: cria os projéteis de um disparo (o laço que hoje está em `fireWeapon`) |
| `shared/sim/armas/modes/discrete.js` (novo) | `shot`, `burst`, `split`, `singularity`, `variants`, `charge`, `spinup` |
| `shared/sim/armas/modes/continuous.js` (novo) | `beam`, `flame` |
| `shared/sim/armas/modes/ground.js` (novo) | `lob`, `rain`, `chain` |
| `shared/sim/armas/modes/summon.js` (novo) | `deploy`, `orbit` |
| `shared/sim/armas/modes/index.js` (novo) | `MODES` reúne todos |
| `shared/sim/armas/melee.js` (novo) | `swing` (código atual), `thrust`, `combo`, `shield` |
| `shared/sim/armas/Projectiles.js` | divisão, singularidade, arremesso (`lob`), órbita, poças, bloqueio pelo escudo |
| `shared/sim/areas.js` | áreas `singularity`, `rain_mark`, `pool` |
| `shared/sim/personagens/Allies.js` | aliados por tipo (`planta`, `turret`, `mine`); `createAlly` |
| `shared/sim/World.js` | `world.beams` limpo a cada passo e na troca de andar |
| `shared/net/snapshot.js` | serializa/decodifica estado novo |
| `client/src/render/WorldRenderer.js`, `Effects.js`, `SpriteFactory.js`, `itemArt.js`, `enemyArt.js`, `propArt.js` | desenho do estado novo e sprites novos |
| `client/src/ui/WeaponCard.js`, `client/src/scenes/HudScene.js` | modo no card; mensagens do revive |
| `shared/data/weapons.json`, `docs/ARMAS.md`, `README.md` | conteúdo e documentação |
| `scripts/smoke.mjs` (novo) | teste de fumaça no navegador (Playwright), rodado à mão |
| `scripts/weapon-dps.mjs` (novo) | tabela de dano por segundo de cada arma contra um alvo parado |
| `test/weapons.test.js` (novo) | testes dos modos |

---

## Etapa 1

### Task 1: Bug do menu (e o mesmo bug no lobby) + teste de fumaça no navegador

**Files:**
- Modify: `client/src/scenes/MenuScene.js` (`create()`), `client/src/scenes/LobbyScene.js` (`create()`)
- Create: `scripts/smoke.mjs`

**Interfaces:**
- Produces: `node scripts/smoke.mjs [--url http://localhost:3000]` — sobe nada sozinho; espera o servidor rodando. Sai com código 0 se passar. As tarefas seguintes acrescentam cenários a ele.

Causa: `MenuScene.go()` faz `this.leaving = true` e o Phaser reaproveita a instância da cena; `create()` não volta para `false`. `LobbyScene.started` tem o mesmo problema (voltar ao lobby por "TROCAR TIME" ou "VOLTAR À SALA" impede começar de novo).

- [ ] **Step 1: Escrever `scripts/smoke.mjs`** com Playwright (`createRequire(import.meta.url)('playwright')`; se falhar, `executablePath: '/opt/pw-browsers/chromium'`). Cenário `menu-volta`:
  1. abre a URL, espera `window.__game.scene.isActive('Menu')`;
  2. clica no botão "JOGAR SOLO" (converter a coordenada do jogo `(GAME_W / 2, 240)` para a tela usando `__game.canvas.getBoundingClientRect()` e `GAME_W/GAME_H` de `client/src/config.js`);
  3. espera `CharacterSelect` ativa, aperta `Escape`, espera `Menu` ativa;
  4. clica de novo em "JOGAR SOLO" e espera `CharacterSelect` ativa em até 2 s;
  5. falha se houver `pageerror` ou `console.error`.
- [ ] **Step 2: Rodar e ver falhar**

Run: `npm start &` e depois `node scripts/smoke.mjs`
Expected: FAIL no passo 4 (cena `CharacterSelect` não abre na segunda vez).

- [ ] **Step 3: Corrigir** — primeira linha de `MenuScene.create()`: `this.leaving = false; this.controls = null;`. Em `LobbyScene.create()`: `this.started = false;`. Conferir que nenhuma outra cena guarda flag de "saindo" fora de `create()`/`init()` (`GameScene` já reseta `ended`/`menuOpen`).
- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/smoke.mjs`
Expected: `ok menu-volta` e código de saída 0.

- [ ] **Step 5: Commit** — `git add client/src/scenes/MenuScene.js client/src/scenes/LobbyScene.js scripts/smoke.mjs` · `fix: menu e lobby voltam a aceitar cliques depois de sair e voltar`

### Task 2: Revive novo (parado e sem atirar por 5 s)

**Files:**
- Modify: `shared/sim/constants.js` (`REVIVE_TIME`), `shared/sim/personagens/Player.js` (`updateRevive`, guardar `p.firing`), `client/src/render/WorldRenderer.js:225` (anel usa `REVIVE_TIME`), `client/src/scenes/HudScene.js:262` (mensagens)
- Test: `test/sim.test.js` (substituir o teste "co-op: jogador caído é revivido por colega perto por 3 s...")

**Interfaces:**
- Produces: `p.firing: boolean` (o jogador estava segurando atirar neste passo; a Tarefa 4 reaproveita). `REVIVE_TIME = 5`.

- [ ] **Step 1: Escrever os testes**

```js
test('co-op: colega parado e sem atirar por 5 s levanta quem caiu; todos caídos = derrota', () => {
  const w = new World({ data, seed: 5, players: [{ id: 'a', characterId: 'harilson' }, { id: 'b', characterId: 'ana_claudia' }] });
  const [a, b] = w.players;
  a.shield = 0; hurtPlayer(w, a, 99);
  b.x = a.x + 20; b.y = a.y;
  run(w, 4.5);
  assert.ok(a.downed, 'ainda não: precisa de 5 s');
  run(w, 0.7);
  assert.ok(!a.downed);
  assert.ok(a.hp > 0);
  a.invuln = b.invuln = 0; a.shield = b.shield = 0;
  hurtPlayer(w, a, 99); hurtPlayer(w, b, 99);
  run(w, 0.1);
  assert.equal(w.state, 'defeat');
});

test('revive zera se o colega se mexer ou atirar', () => {
  const w = new World({ data, seed: 5, players: [{ id: 'a', characterId: 'harilson' }, { id: 'b', characterId: 'ana_claudia' }] });
  const [a, b] = w.players;
  a.shield = 0; hurtPlayer(w, a, 99);
  b.x = a.x + 20; b.y = a.y;
  run(w, 3);
  run(w, 0.1, { b: { fire: true, aim: Math.PI } });
  assert.equal(a.reviveProgress, 0, 'atirou: zera');
  run(w, 3);
  run(w, 0.05, { b: { moveX: 0.01, moveY: 1 } });
  assert.equal(a.reviveProgress, 0, 'mexeu: zera');
});
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test test/sim.test.js` → FAIL (levanta em 3 s; progresso não zera).
- [ ] **Step 3: Implementar.** Em `updatePlayer`, guardar `p.firing = !!inp.fire` antes de qualquer `return` antecipado (cair, preso, puxado). `updateRevive`: ajudante válido = colega não caído, não morto, não assinando, não preso, dentro de `REVIVE_RADIUS`, com `!q.moving && !q.firing`. Com ajudante: progresso sobe; sem: progresso = 0. Renderizador: `prog = p.reviveProgress / REVIVE_TIME`. HUD: caído vê "Caído! Um colega precisa ficar parado e sem atirar perto de você por 5 s"; um jogador local vivo perto de um caído vê "Fique parado e sem atirar para levantar {nome}". Revive pelo portal (`World.completeFloor`) não muda.
- [ ] **Step 4: Rodar** — `npm test` → todos passam.
- [ ] **Step 5: Commit** — `feat: revive exige colega parado e sem atirar por 5 s`

---

## Etapa 2

### Task 3: Dados — modos, estilos, padrões e validação

**Files:**
- Modify: `shared/sim/data.js`
- Test: `test/data.test.js`

**Interfaces:**
- Produces (exportados de `data.js`):
  - `WEAPON_MODES = ['shot','burst','charge','spinup','beam','flame','lob','split','chain','deploy','singularity','rain','orbit','variants']`
  - `MELEE_STYLES = ['swing','thrust','combo','shield']`
  - `MODE_LABELS` (pt-BR, para o card): `shot: 'Tiro'`, `burst: 'Rajada'`, `charge: 'Carregar'`, `spinup: 'Aquecimento'`, `beam: 'Laser contínuo'`, `flame: 'Lança-chamas'`, `lob: 'Arremesso em arco'`, `split: 'Tiro que se divide'`, `chain: 'Raio em cadeia'`, `deploy: 'Coloca no chão'`, `singularity: 'Buraco negro'`, `rain: 'Chuva'`, `orbit: 'Órbita'`, `variants: 'Sorteio'`, `swing: 'Golpe'`, `thrust: 'Estocada'`, `combo: 'Combo'`, `shield: 'Escudo'`.
  - `normalizeWeapon(w)` passa a preencher `w.mode` (padrão `'shot'` para ranged), `w.melee.style` (padrão `'swing'`) e `w[mode]` com os padrões do modo (`MODE_DEFAULTS[mode]` mesclado com o bloco do JSON). Cada variante de `variants.list` é normalizada como um `projectile` completo.
  - Padrões (nomes fixos; valores iniciais, ajustáveis na Tarefa 11):
    - `burst: { count: 3, interval: 0.07 }`
    - `charge: { time: 1.0, minMul: 0.4, maxMul: 2.5, fullPierce: 0, fullCount: 1 }`
    - `spinup: { startMul: 0.35, maxMul: 1.6, rampTime: 1.4 }`
    - `beam: { dps: 20, tick: 0.1, range: 420, width: 6, pierce: false, ghost: false, energyPerSec: 6 }`
    - `flame: { range: 130, arc: 40, particles: 2 }`
    - `lob: { maxRange: 360, flightTime: 0.6, peak: 50, fuse: 0, bounces: 0, pool: null }`
    - `split: { into: 3, childDamageMul: 0.5, spread: 60 }`
    - `chain: { range: 300, chains: 3, radius: 130, falloff: 0.8, aimCone: 35 }`
    - `deploy: { kind: 'mine', max: 3, life: 12, radius: 60, damage: 12, fireRate: 2, range: 220, triggerRadius: 28 }`
    - `singularity: { pullRadius: 110, life: 2.5, dps: 8, pull: 170 }`
    - `rain: { count: 5, radius: 70, delay: 0.5, hitRadius: 26 }`
    - `orbit: { max: 4, radius: 34, spin: 4, launchSpeed: 480 }`
    - `variants: { list: [] }`
    - melee extra: `thrust: { distance: 110, time: 0.16 }`, `combo: { steps: 3, finisherMul: 2, finisherArcBonus: 40, resetTime: 0.7 }`, `shield: { arc: 110, blockCost: 1, speedMul: 0.6, bashKnockback: 320 }`
  - `pool` (usado por `lob.pool`, `projectile.pool`): `{ r: 40, life: 3, dps: 2, effect: null, slowMul: 1, style: 'paint' }`.
  - `PROJECTILE_DEFAULTS` ganha `pool: null`, `glyphSplit: null`, `growOnReturn: 1` (usados nas Tarefas 7 e 11).
- Validação nova: `mode` desconhecido → `"<id>: modo desconhecido \"x\""`; `melee.style` desconhecido → `"<id>: estilo de corpo a corpo desconhecido \"x\""`; `variants` sem lista ou vazia → erro; `deploy.kind` fora de `['mine','turret']` → erro; chaves desconhecidas dentro de um bloco de modo → erro `"<id>: campo desconhecido \"x\" em <modo>"` (pega erro de digitação).

- [ ] **Step 1: Escrever testes** em `test/data.test.js`: (a) arma sem `mode` normaliza para `'shot'` e melee sem estilo para `'swing'`; (b) `{ mode: 'beam', beam: { dps: 30 } }` normaliza com `beam.dps === 30` e `beam.tick === 0.1`; (c) validador acusa `mode: 'laserzao'`, `melee.style: 'voadora'`, `variants: { list: [] }`, `deploy: { kind: 'canhao' }` e `charge: { tiem: 1 }`; (d) todo `MODE_LABELS` cobre `WEAPON_MODES` e `MELEE_STYLES`.
- [ ] **Step 2: Rodar e ver falhar** — `node --test test/data.test.js`.
- [ ] **Step 3: Implementar** em `data.js`.
- [ ] **Step 4: Rodar** — `npm test` → passa.
- [ ] **Step 5: Commit** — `feat: dados de armas aceitam modos e estilos de corpo a corpo`

### Task 4: Input (`aimDist`, soltar o botão) e despachante de armas

**Files:**
- Modify: `shared/sim/constants.js`, `shared/net/InputBuffer.js`, `client/src/input/Controllers.js`, `client/src/net/OnlineSession.js`, `shared/sim/personagens/Player.js`, `shared/sim/armas/Weapons.js`
- Create: `shared/sim/armas/shots.js`, `shared/sim/armas/modes/index.js`, `shared/sim/armas/modes/discrete.js` (só `shot` nesta tarefa), `shared/sim/armas/melee.js` (só `swing`, movendo `meleeSwing` atual)
- Test: `test/weapons.test.js` (novo), `test/online.test.js`

**Interfaces:**
- Consumes: `normalizeWeapon` da Tarefa 3; `p.firing` da Tarefa 2.
- Produces:
  - Input: `{ ..., aimDist: number }`. `sanitizeInput` limita a `[0, MAX_AIM_DIST]`; não numérico → `DEFAULT_AIM_DIST`. Mouse: distância do cursor ao jogador; controle/2º teclado: distância do alvo da mira automática, ou `DEFAULT_AIM_DIST`.
  - Player: `p.aimDist`, `p.prevFire`, `p.wstate` (ver abaixo), `p.dash = null`.
  - `p.wstate = { weaponId, charge: 0, chargeFull: false, spin: 0, burstLeft: 0, burstT: 0, combo: 0, comboT: 0, shielding: false }`
  - `Weapons.js`:
    - `updateWeapon(world, p, inp, dt): void` — chamada em `updatePlayer` no lugar de `if (inp.fire && ...) fireWeapon(...)`. Ordem: se `p.wstate.weaponId !== p.weapons[p.cur]`, `resetWeaponState(p)`; `p.fireCd -= dt`; pega `handler = w.type === 'melee' ? MELEE_STYLES[w.melee.style] : MODES[w.mode]`; se segurando e não pode atacar (assinando) trata como não segurando; segurando → `handler.hold(world, p, w, dt)`; não segurando → `handler.idle?.(world, p, w, dt)`; se `p.prevFire && !segurando` → `handler.release?.(world, p, w)`; por fim `p.prevFire = segurando`.
    - `resetWeaponState(p): void` — zera `p.wstate` (mantendo `weaponId` novo), larga órbitas (Tarefa 8 completa), apaga escudo.
    - `tryPay(world, p, w, cost = energyCost(p, w)): boolean` — desconta ou emite `no_energy` (com o `noEnergyCd` atual).
    - `energyCost(p, w)` sem mudança.
    - `startCooldown(p, w, mul = 1): void` — `p.fireCd = mul / (w.fireRate * p.mods.fireRateMul * (haste ? 1.6 : 1))`.
    - `fireWeapon` deixa de existir (só `Player.js` usava).
  - `shots.js`: `spawnShot(world, p, w, opts = {}): Projectile[]` com `opts = { angle = p.aim, proj = w.projectile, damageMul = 1, speedMul = 1, extraPierce = 0, countOverride, critMul = 1 }`. Faz o que o laço atual de `fireWeapon` faz (leque, imprecisão, sinais/glifos, vogais da Marina, crítico, efeito, empurrão) e põe no projétil os campos novos que as Tarefas 5–8 usam: `split = w.split` se `w.mode === 'split'` (ou se o glifo sorteado for `proj.glyphSplit`), `singularity = w.singularity` se `w.mode === 'singularity'`, e `pool = proj.pool`.
  - Interface de um modo/estilo: `{ hold(world, p, w, dt), idle?(world, p, w, dt), release?(world, p, w) }`.
  - `MODES.shot.hold`: se `p.fireCd <= 0 && tryPay(...)` → `spawnShot`, `startCooldown`, `doubleShot` (passivo Bilíngue) e evento `shoot` com `mode` no payload.
  - `MELEE_STYLES.swing.hold`: o `meleeSwing` atual, com o mesmo controle de recarga.

- [ ] **Step 1: Escrever testes** em `test/weapons.test.js` (usar `makeWorld`, `run` de `test/helpers.js`; criar helper local `dummy(w, x, y, hp = 500)` que chama `createEnemy(w, 'caderno_zumbi', x, y, -1, { spawnTime: 0 })`, define `e.hp = e.maxHp = hp` e troca `e.def = { ...e.def, behavior: 'none', contactDamage: 0, drops: {} }` (sem comportamento: fica parado e não ataca)):
  - `shot sem mode dispara igual a antes`: Harilson segurando atirar 0,5 s → `w.projectiles.length > 0`.
  - `trocar de arma reseta o estado`: com `p.weapons = ['pistola_grampos','regua_espada']`, `p.wstate.charge = 0.7`, `run(w, 1/60, { p1: { swap: true } })` → `p.wstate.charge === 0` e `p.wstate.weaponId === 'regua_espada'`.
  - `pegar arma do chão também reseta` (simular trocando `p.weapons[p.cur]` direto e rodando 1 passo).
  - `assinando não atira e não solta carga` (`p.signing = 2`, segurando).
  - Em `test/online.test.js`: `sanitizeInput({ aimDist: NaN }).aimDist === DEFAULT_AIM_DIST`, `sanitizeInput({ aimDist: -5 }).aimDist === 0`, `sanitizeInput({ aimDist: 1e9 }).aimDist === MAX_AIM_DIST`.
- [ ] **Step 2: Rodar e ver falhar** — `node --test test/weapons.test.js test/online.test.js`.
- [ ] **Step 3: Implementar** a refatoração; os 30 testes antigos continuam passando sem mudar comportamento.
- [ ] **Step 4: Rodar** — `npm test` → passa; `node scripts/smoke.mjs` → passa.
- [ ] **Step 5: Commit** — `refactor: despachante de armas por modo e input com distância da mira`

### Task 5: Modos discretos — `burst`, `variants`, `split`, `singularity`, `charge`, `spinup`

**Files:**
- Modify: `shared/sim/armas/modes/discrete.js`, `shared/sim/armas/modes/index.js`, `shared/sim/armas/Projectiles.js` (`impact`), `shared/sim/areas.js`
- Test: `test/weapons.test.js`

**Interfaces:**
- Consumes: `spawnShot`, `tryPay`, `startCooldown`, `p.wstate` (Tarefa 4).
- Produces:
  - `burst`: o primeiro tiro sai ao apertar; `wstate.burstLeft = count - 1` saem a cada `interval` (no `hold` ou no `idle`, mesmo soltando); energia paga uma vez por rajada; recarga começa depois do último.
  - `variants`: cada disparo sorteia `world.rng.pick(w.variants.list)` e passa como `proj` para `spawnShot`; a variante pode ter `damageMul`.
  - `split` (= `shot` + projétil com `split`): em `impact`, se `p.split && !p.child`, cria `into` filhos em leque `spread` graus centrado na direção oposta à parede ou na direção do voo (inimigo), com `damage * childDamageMul`, `child: true`, sem `split`; filhos não acertam o inimigo que causou a divisão (`hit` copiado).
  - `singularity` (= `shot` + projétil com `singularity`): ao bater ou acabar o alcance, cria área `singularity` com `{ r: pullRadius, life, dps, pull, ownerId }`. Em `areas.js`, `gravity` e `singularity` passam a usar o mesmo código, com `pull` e `dps` por área (padrão de `gravity` = valores atuais: puxão 190, chefe 30, 3 de dano a cada 0,5 s).
  - `charge`: `hold` sobe `wstate.charge += dt / time` até 1 (sem disparar); ao chegar em 1 pela primeira vez emite `charge_full`. `release`: se `charge > 0.05`, paga energia, `mul = minMul + (maxMul - minMul) * charge`, `spawnShot` com `damageMul: mul, speedMul: 0.8 + 0.4 * charge`; com carga cheia soma `fullPierce` e usa `countOverride: fullCount`; emite `charge_release { playerId, level }`; zera a carga e inicia recarga. Respeita `p.fireCd` antes de começar a carregar.
  - `spinup`: `hold` sobe `wstate.spin` até 1 em `rampTime`; cadência = `startMul + (maxMul - startMul) * spin`; `idle` desce o `spin` 2× mais rápido.
- [ ] **Step 1: Escrever testes** (cada um com uma arma de teste injetada: `data.weapons.set('t_x', normalizeWeapon({...}))` num helper `withWeapon(w, def)` que também põe a arma na mão do jogador):
  - `burst: um clique solta 3 tiros e cobra energia uma vez` (energia antes − depois === `energyCost`).
  - `charge: segurar não atira; soltar com carga cheia dá dano maxMul×` (projétil tem `damage === round(base * 2.5)`; evento `charge_full` emitido uma vez).
  - `charge: soltar cedo dá tiro fraco` (`damage < base`).
  - `spinup: em 2 s segurando sai mais tiro no 2º segundo que no 1º`.
  - `split: tiro que bate na parede vira 3 filhos com metade do dano e filho não se divide`.
  - `singularity: tiro vira área que puxa inimigo` (distância do dummy ao centro diminui).
  - `variants: 30 disparos usam pelo menos 2 variantes`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test` → passa.
- [ ] **Step 5: Commit** — `feat: modos rajada, carregar, aquecimento, divisão, buraco negro e sorteio`

### Task 6: Modos contínuos — `beam` e `flame`

**Files:**
- Create: `shared/sim/armas/modes/continuous.js`
- Modify: `shared/sim/armas/modes/index.js`, `shared/sim/World.js` (`this.beams = []` no construtor, em `setupFloor` e no começo de `step`), `shared/sim/salas/TileMap.js` (se não houver, `raycast(x, y, angle, maxDist): { x, y, dist }` com passo de 4 px)
- Test: `test/weapons.test.js`

**Interfaces:**
- Produces:
  - `world.beams: Array<{ ownerId, x1, y1, x2, y2, width, color }>` — recriado a cada passo; só existe enquanto alguém segura um `beam`.
  - `beam.hold`: energia contínua — acumula `energyPerSec * dt * p.mods.energyCostMul`, cobra em unidades inteiras via `tryPay` (sem energia: não desenha raio e emite `no_energy`). Raio da boca da arma até a parede (`raycast`; `ghost: true` ignora parede e vai até `range`); sem `pierce`, para no primeiro inimigo cuja distância à linha seja `< e.r + width/2`. A cada `tick` causa `dps * tick` em cada inimigo atingido, com crítico em `0.5 ×` a chance normal e efeito da arma com `0.5 ×` a chance. Quebra caixas no fim do raio. Empurra `world.beams.push(...)` com `color = w.projectile.sprite.color`.
  - `flame.hold`: respeita `fireRate`; cada disparo cria `particles` projéteis curtos (`range`, ângulo aleatório dentro de `arc`, `pierce: 99`, `sprite: 'proj_' + w.id`, velocidade `range / 0.35`), que não atravessam parede. Crítico e efeito por partícula com `0.5 ×` a chance.
- [ ] **Step 1: Escrever testes:**
  - `beam acerta inimigo na linha e não acerta atrás da parede` (dummy à frente perde vida; dummy atrás de uma parede/obstáculo não; usar posições de `putInRoom` e um tile `T.WALL` posto à mão com `w.map.set`).
  - `beam sem pierce para no primeiro inimigo` (dois dummies alinhados; só o primeiro perde vida).
  - `beam sem energia não liga e avisa` (`p.energy = 0` → `w.beams.length === 0`, evento `no_energy`, `p.energy >= 0`).
  - `beam some quando solta o botão` (1 passo depois de soltar, `w.beams.length === 0`).
  - `flame acerta vários inimigos no cone e não passa da parede`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: laser contínuo e lança-chamas`

### Task 7: Modos no chão — `lob`, `rain`, `chain`

**Files:**
- Create: `shared/sim/armas/modes/ground.js`
- Modify: `shared/sim/armas/modes/index.js`, `shared/sim/armas/Projectiles.js`, `shared/sim/areas.js`, `shared/sim/combat.js` (exportar `chainShock` ou criar `chainFrom(world, first, opts)` reaproveitando o código)
- Test: `test/weapons.test.js`

**Interfaces:**
- Produces:
  - Ponto mirado: `aimPoint(world, p, maxRange): { x, y }` em `ground.js` — `min(p.aimDist, maxRange)` na direção `p.aim`; se o ponto cair em tile sólido ou fora do mapa, recua pela linha até o último ponto de chão.
  - `lob`: cria projétil com `lob: { sx, sy, tx, ty, t: 0, flight: flightTime, peak, bounces }`, `ghost: true` durante o voo, sem colidir com inimigos. Em `updateProjectiles`, projétil com `lob` anda pela interpolação `s → t` e calcula `z = 4 * peak * k * (1 - k)` (`k = t / flight`). Ao chegar: se `bounces > 0`, quica (novo alvo 40% da distância à frente, `bounces--`); senão, se `fuse > 0` espera parado `fuse` s; depois `explode(...)` com `w.projectile.explode` e cria `pool` se houver.
  - `pool`: área `pool` com `{ r, life, dps, effect, slowMul, style, ownerId }`; a cada 0,5 s causa `dps * 0.5` e aplica `effect` em inimigos dentro; com `slowMul < 1` deixa lento (`status.slow`). Não afeta jogadores.
  - `rain`: em volta de `aimPoint`, cria `count` áreas `rain_mark` em pontos aleatórios dentro de `radius`, com `life = delay + i * 0.08`; ao acabar cada uma, causa `w.damage` (com crítico) a inimigos a menos de `hitRadius` e emite `proj_hit` com `style: 'proj_' + w.id`.
  - `chain`: sem projétil. Alvo = inimigo vivo mais próximo da mira dentro de `range`, com linha de visão e ângulo até a mira `<= aimCone`. Dano `w.damage` (crítico normal), efeito da arma; depois pula `chains` vezes para o vizinho mais próximo em `radius` com dano multiplicado por `falloff` a cada salto. Emite `chain { points }` (o efeito de raio já existe). Sem alvo: emite `chain` curto até 60 px à frente e não gasta energia.
- [ ] **Step 1: Escrever testes:**
  - `lob cai no ponto mirado e passa por cima de inimigo no caminho` (dummy no meio do caminho intacto; dummy no ponto mirado perde vida).
  - `lob mirando dentro da parede cai antes da parede` (posição da explosão no chão).
  - `pool envenena inimigo parado nela`.
  - `rain marca o chão antes de causar dano` (no 1º passo: áreas `rain_mark` existem e dummy intacto; depois de `delay + 0.5`: dummy perdeu vida).
  - `chain acerta o mais próximo da mira e pula para 2 vizinhos` (3 dummies; os 3 perdem vida; o 3º perde menos que o 1º).
  - `chain sem alvo não gasta energia`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: arremesso em arco, chuva, poças e raio em cadeia`

### Task 8: `deploy` (mina e torreta) e `orbit`; limpeza na troca de andar

**Files:**
- Create: `shared/sim/armas/modes/summon.js`
- Modify: `shared/sim/armas/modes/index.js`, `shared/sim/personagens/Allies.js`, `shared/sim/personagens/skills.js` (`planta_carnivora` passa a usar `createAlly`), `shared/sim/armas/Projectiles.js`, `shared/sim/armas/Weapons.js` (`resetWeaponState` larga órbitas)
- Test: `test/weapons.test.js`, `test/floors.test.js` (troca de andar)

**Interfaces:**
- Produces:
  - `Allies.js`: `createAlly(world, kind, x, y, opts): Ally` (campos atuais + `kind`, `ownerId`, `life`, `maxLife`, mais `opts`); `countAllies(world, ownerId, kind): number`; `ALLY_KINDS = { planta, turret, mine }`, cada um `update(world, a, dt, owner)`. `updateAllies` só faz vida/expiração e chama o tipo. A Etapa 4 acrescenta tipos novos aqui.
  - `mine`: arma em 0,5 s; inimigo a menos de `triggerRadius` → `explode(world, x, y, radius, damage, { source: owner })` e morre. Desarmada: piscando.
  - `turret`: atira no inimigo vivo mais próximo com linha de visão dentro de `range`, `fireRate` tiros/s, `damage` por tiro, sprite `'proj_' + weaponId`.
  - `deploy.hold`: com recarga pronta e energia, coloca em `aimPoint(world, p, 60)` (ou aos pés se sólido); se o dono já tem `max` daquele tipo, remove o mais antigo. Evento `deploy { kind, x, y }`.
  - `orbit`: cada disparo cria projétil com `orbit: { ownerId, angle, radius, spin }` e `range` infinito enquanto orbita; ele gira em volta do dono, acerta inimigo que encostar (cada inimigo no máximo a cada 0,5 s) e apaga bala inimiga que encostar. Com `max` orbitando, o disparo seguinte lança todos na direção da mira (`launchSpeed`, `range` normal). `resetWeaponState` lança os que estiverem orbitando.
  - Troca de andar: `setupFloor` já zera listas; garantir que `world.beams` também zera e que nada guarda referência a projétil antigo em `p.wstate`.
- [ ] **Step 1: Escrever testes:**
  - `mina explode quando inimigo passa e respeita o máximo de 3` (4ª mina remove a 1ª).
  - `torreta atira sozinha e some ao fim da vida`.
  - `planta carnívora continua funcionando` (o teste de `floors.test.js` "habilidades dos professores novos funcionam" segue passando).
  - `órbita protege: bala inimiga que encosta some`; `com 4 em órbita o próximo disparo lança todos`.
  - `trocar de andar com minas, órbitas, raio e arremesso no ar não dá erro` (montar tudo e chamar `w.completeFloor()`; depois `run(w, 1)` sem exceção e listas vazias).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: minas, torretas e projéteis em órbita`

### Task 9: Corpo a corpo — `thrust`, `combo`, `shield`

**Files:**
- Modify: `shared/sim/armas/melee.js`, `shared/sim/personagens/Player.js` (movimento da estocada, limpeza ao cair/preso/puxado), `shared/sim/armas/Projectiles.js` (bloqueio do escudo), `shared/sim/combat.js` (`hurtPlayer` ignora dano durante `p.dash`)
- Test: `test/weapons.test.js`

**Interfaces:**
- Produces:
  - `thrust.hold`: com recarga pronta, cria `p.dash = { vx, vy, t: time, hit: new Set(), w }` na direção da mira com velocidade `distance / time`. `Player.updatePlayer` com `p.dash` ativo: move com `world.map.moveBox` (para na parede), ignora o input de movimento, causa dano/empurrão a cada inimigo que tocar (uma vez cada) e fica invulnerável. Evento `thrust { playerId, x, y, angle }`.
  - `combo.hold`: cada golpe usa o `swing` com `wstate.combo` (0,1,2); o 3º usa `damage * finisherMul` e `arc + finisherArcBonus`; `wstate.comboT` volta o combo a 0 depois de `resetTime` sem golpe. Evento `swing` ganha `step`.
  - `shield.hold`: `wstate.shielding = true`; velocidade do jogador × `speedMul`; não ataca. Em `updateProjectiles` (bala inimiga), se o jogador atingido está com escudo e o ângulo da bala até ele está dentro de `arc/2` da mira, a bala some, cobra `blockCost` de energia (sem energia: o escudo cai e a bala passa) e emite `block { x, y }`. `shield.release`: empurrão (`bashKnockback`) e `w.damage` nos inimigos no arco à frente.
  - Ao cair, ser preso (Suspensão), ser puxado (Conversa Particular) ou começar a assinar: `p.dash = null` e `resetWeaponState(p)`.
- [ ] **Step 1: Escrever testes:**
  - `estocada avança, acerta o inimigo no caminho uma vez e para na parede` (jogador encostado numa parede mirando nela não sai do chão livre: `w.map.solidAt(p.x, p.y) === false`).
  - `estocada deixa invulnerável durante o avanço`.
  - `combo: o 3º golpe dá dano em dobro; parar 1 s volta ao 1º`.
  - `escudo bloqueia bala de frente e gasta energia; bala pelas costas acerta`.
  - `escudo sem energia não bloqueia`.
  - `cair no meio da estocada ou com escudo levantado limpa o estado`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: estocada, combo e escudo no corpo a corpo`

### Task 10: Online — snapshot e previsão com o estado novo

**Files:**
- Modify: `shared/net/snapshot.js`, `client/src/net/OnlineSession.js`
- Test: `test/online.test.js`

**Interfaces:**
- Consumes: estado das Tarefas 4–9.
- Produces:
  - Jogador no snapshot ganha `ws: [charge, spin, shielding ? 1 : 0, combo]` (arredondados com `r1`), `dash: 0|1`, `aimDist`. `decodeSnapshot` remonta `p.wstate = { charge, spin, shielding, combo }` e `p.dash = dash ? {} : null`.
  - Mundo ganha `beams: [[ownerId, x1, y1, x2, y2, width, color], ...]`; decodificado em `world.beams` como objetos.
  - Projétil ganha índice 9 `z` (altura do arremesso, `0` se não for `lob`) e índice 10 alvo do arremesso `[tx, ty]` ou `0`; decodificado em `pr.z` e `pr.lobTarget`.
  - Aliados ganham índice 7 `ownerId` e 8 `armed` (mina).
  - `OnlineSession`: `w.beams = latest.beams`; o raio do próprio jogador é redesenhado a partir da posição prevista (`x1, y1 = pred`); na previsão, `if (me.wstate?.shielding) speed *= shield.speedMul` (ler da arma atual) e, se `me.dash`, não prever (usar posição do servidor).
- [ ] **Step 1: Escrever teste** `snapshot leva raio, carga, arremesso e mina`: sala com 1 jogador, trocar a arma por armas de teste (`beam`, `charge`, `lob`, `deploy`), rodar ticks segurando atirar, e conferir que `decodeSnapshot(data, snap)` tem `beams.length === 1`, `players[0].wstate.charge > 0`, um projétil com `z > 0` e um aliado `kind === 'mine'`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: modo online envia raios, carga, arremessos e minas`

### Task 11: Conteúdo — as cerca de 50 armas, sprites das armas e tabela de dano

**Files:**
- Modify: `shared/data/weapons.json`, `shared/data/characters.json` (só `starterWeaponName` se o nome mudar), `client/src/render/itemArt.js` (`drawWeapon`: formatos novos), `client/src/render/enemyArt.js` (`drawProjectile`: formatos novos)
- Create: `scripts/weapon-dps.mjs`
- Test: `test/data.test.js`, `test/weapons.test.js`

**Interfaces:**
- Consumes: todos os modos.
- Produces: `weapons.json` com, seguindo as tabelas da seção 5.2 do spec:
  - as 6 armas iniciais atuais reconfiguradas (Ana Cláudia `burst`; Harilson com novo sinal `÷` que se divide — `glyphSplit: "÷"` no `projectile`, que `spawnShot` traduz em `split` só para esse glifo; Filipe `variants` basquete/futebol/boliche; Jean Paulo `beam`; Marina `charge`; Vivian `split`);
  - as 8 armas iniciais novas com os ids que `characters.json` já usa: `baloes_ingles` (`orbit`), `catapulta_mini` (`lob`), `pincel_tinta` (`shot` com `projectile.pool` de tinta lenta), `lanca_romana` (melee `thrust`), `frascos_quimicos` (`lob` com poça de veneno), `livro_magico` (`rain`), `raios_eletricos` (`chain`), `globo_bumerangue` (`shot` bumerangue com `pierce: 99` e `growOnReturn: 1.5` — `Projectiles.js` aumenta `r` e dano ao voltar); todas com `starterOnly: true`, `category: "inicial"`, `energyCost: 0`;
  - as 22 outras revisadas conforme a tabela;
  - cerca de 15 novas conforme a tabela (pode cortar até chegar a ~50 no total).
  - Formatos novos de arma na mão (`sprite.shape`) e de projétil, desenhados no estilo dos atuais: arma `laser_pen`, `bunsen`, `grenade`, `stapler`, `drill`, `tack_box`, `fan`, `blackhole`, `scissors`, `clipboard`, `flagpole`, `exam_stack`, `atom`, `confetti`, `tuning_fork`, `xray`, `balloon`, `catapult`, `brush`, `spear`, `flask`, `book`, `coil`, `globe`; projétil `stone`, `paint`, `page`, `flame`, `bubble`, `tack`, `confetti`, `globe`, `basketball`, `soccer`, `bowling`.
  - `scripts/weapon-dps.mjs`: para cada arma, num mundo de teste, segura atirar 10 s contra um dummy de vida infinita parado a 120 px (lob/rain miram nele; mina colocada entre os dois) e imprime `id, raridade, modo, dano/s, energia/s`. Faixas-alvo de dano/s num alvo (média com crítico): iniciais 10–15; comum 10–16; incomum 13–19; rara 16–24; épica 20–30; lendária 26–40. Armas de área ou controle (poça, buraco negro, chuva, escudo, mina) podem ficar até 30% abaixo da faixa.
- [ ] **Step 1: Escrever testes:**
  - em `data.test.js`, trocar `personagens jogáveis têm arma inicial existente` por `todos os 14 professores têm arma inicial existente e grátis`.
  - em `data.test.js`, `há pelo menos 45 armas e pelo menos 12 modos/estilos diferentes em uso`.
  - em `weapons.test.js`, `toda arma dispara 5 s sem erro e causa dano num dummy` (laço sobre `data.weapons`; para `deploy`/`orbit`/`shield` aceita dano via mina/órbita/empurrão ao soltar; `shield` testa bloqueio em vez de dano).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Escrever o JSON e os desenhos; rodar `node scripts/weapon-dps.mjs` e ajustar números até cada arma ficar na faixa.**
- [ ] **Step 4: Rodar** — `npm test` e `node scripts/weapon-dps.mjs` (nenhuma linha marcada `FORA DA FAIXA`).
- [ ] **Step 5: Commit** — `feat: cerca de 50 armas com mecânicas próprias`

### Task 12: Desenho, efeitos, sons, card e documentação

**Files:**
- Modify: `client/src/render/WorldRenderer.js`, `client/src/render/Effects.js`, `client/src/render/SpriteFactory.js`, `client/src/render/propArt.js` (sprites `ally_turret`, `ally_mine`), `client/src/audio/Sound.js` (sons novos com o sintetizador atual), `client/src/ui/WeaponCard.js`, `client/src/scenes/HudScene.js`, `docs/ARMAS.md`, `README.md`, `scripts/smoke.mjs`
- Test: `test/data.test.js` (o exemplo do `docs/ARMAS.md` continua válido)

**Interfaces:**
- Consumes: estado e eventos das Tarefas 4–10.
- Produces (o que o jogador vê):
  - `world.beams`: linha grossa com núcleo claro e brilho na cor da arma, tremendo levemente; faísca no ponto final.
  - Projétil com `z > 0`: sprite subido `z` px, sombra no chão e marcador do alvo (`pr.lobTarget`).
  - Carga: arco em volta do jogador enchendo; brilho e som ao encher (`charge_full`); a arma treme no `spinup` alto.
  - Escudo: arco semitransparente na frente do jogador; faísca e som em `block`.
  - Estocada: rastro curto; combo: o 3º golpe com corte maior.
  - Áreas: `singularity` (reaproveita o desenho de `gravity`), `rain_mark` (círculo de aviso que fecha), `pool` (mancha na cor do `style`: tinta, ácido, fogo, gelo).
  - Aliados `turret` e `mine` (mina pisca até armar).
  - Mira: com arma `lob`/`rain`/`deploy`, a mira do mouse mostra o círculo do ponto de impacto limitado ao alcance.
  - Card da arma: linha `Modo: <MODE_LABELS>`; `beam` mostra `Dano: X/s`; `charge` mostra `Dano: min–max`.
  - `docs/ARMAS.md`: seção "Modos" com os campos de cada modo e estilo, e o exemplo completo atualizado (com `mode`); `README.md`: versão 0.3 em andamento, lista de modos.
  - `scripts/smoke.mjs`: cenário `armas` — começa partida solo com cada professor jogável, injeta pelo console (`__game.scene.getScene('Game').world`) uma arma de cada modo, segura atirar 1 s, troca, e falha se houver erro no console; com `--shots <pasta>` salva uma captura por modo nessa pasta (não vai para o repositório).
- [ ] **Step 1: Atualizar o exemplo do `docs/ARMAS.md`** para usar `mode: "charge"`; rodar `node --test test/data.test.js` → passa.
- [ ] **Step 2: Implementar o desenho e os efeitos.**
- [ ] **Step 3: Rodar** `npm start` e `node scripts/smoke.mjs` → `ok menu-volta`, `ok armas`; com `--shots`, abrir as capturas e conferir que cada modo aparece (raio visível, arremesso com sombra, mina, órbita, escudo, carga).
- [ ] **Step 4: Rodar** — `npm test`.
- [ ] **Step 5: Commit** — `feat: visual e sons das mecânicas novas; docs de armas`

### Task 13: Verificação final das etapas 1 e 2

**Files:** nenhum novo.

- [ ] **Step 1:** `npm test` → todos passam.
- [ ] **Step 2:** `npm start` e `node scripts/smoke.mjs` → todos os cenários `ok`.
- [ ] **Step 3:** Teste online à mão com dois navegadores do Playwright (cenário extra `online` no `smoke.mjs`: um cria sala, outro entra pelo código, ambos prontos, um usa arma `beam` e outra `lob`; o segundo navegador recebe `beams.length > 0` e projétil com `z > 0` no espelho).
- [ ] **Step 4:** `git push -u origin claude/v0.3-armas-inimigos` e resumo para o dono: o que mudou, como testar, capturas principais.
