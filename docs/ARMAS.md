# Como criar armas novas (sem mexer no código)

Todas as armas ficam em `shared/data/weapons.json`. Para criar uma arma nova, copie um bloco da lista
`"weapons"`, troque o `id` (único, sem espaços) e ajuste os valores. Recarregue a página do jogo.
Se algum campo estiver errado, o jogo mostra o erro na tela de carregamento (e `npm test` também acusa).

## Campos

| Campo | Obrigatório | O que faz |
|---|---|---|
| `id` | sim | Identificador único (ex.: `"apagador_turbo"`). |
| `name` | sim | Nome mostrado no card. |
| `category` | sim | `fogo`, `corpo`, `magica`, `arremesso`, `especial` (ou `inicial`). |
| `rarity` | sim | `comum` (branco), `incomum` (verde), `rara` (azul), `epica` (roxa), `lendaria` (laranja). |
| `type` | sim | `ranged` (atira projéteis) ou `melee` (corpo a corpo). |
| `mode` | não | Mecânica de disparo das armas `ranged` (padrão `shot`). Veja **Modos** abaixo. |
| `damage` | sim | Dano de cada projétil / golpe. |
| `fireRate` | sim | Disparos por segundo (no `beam`, ignorado; no `burst`, rajadas por segundo). |
| `energyCost` | sim | Energia gasta por disparo (0 = grátis). |
| `critChance` | sim | Chance de crítico, de 0 a 1 (crítico = dano x2). |
| `inaccuracy` | sim | Imprecisão em graus (0 = perfeita). |
| `starterOnly` | não | `true` = só aparece como arma inicial (não cai de baús). |
| `description` | não | Texto livre. |
| `effect` | não | Efeito especial (veja abaixo). |
| `projectile` | para `ranged` | Configuração do projétil (veja abaixo). |
| `melee` | para `melee` | Configuração do golpe (veja abaixo). |
| `sprite` | não | Aparência da arma na mão: `{ "shape", "color", "accent" }`. |

### `projectile`

| Campo | Padrão | O que faz |
|---|---|---|
| `speed` | 450 | Velocidade (pixels/s). |
| `radius` | 5 | Tamanho para colisão. |
| `range` | 500 | Distância máxima. |
| `count` | 1 | Projéteis por disparo (escopeta = vários). |
| `spread` | 0 | Abertura do leque, em graus (com `count` > 1). |
| `pierce` | 0 | **Perfuração**: quantos inimigos atravessa (99 = todos). |
| `bounce` | 0 | **Ricochete**: quantas vezes quica na parede. |
| `homing` | 0 | Teleguiado: quanto vira por segundo (ex.: 2.5). |
| `boomerang` | false | Vai e volta para o jogador. |
| `explode` | — | **Explosão** ao acertar: `{ "radius": 60, "damage": 10 }`. |
| `explodeOnExpire` | false | Também explode ao fim do alcance. |
| `spin` | 0 | Gira enquanto voa (só visual). |
| `knockback` | 0 | **Empurrão** do projétil no inimigo (soma ao do jogador). Ex.: boliche = 220. |
| `sharedHit` | false | **Um acerto por disparo**: os projéteis do mesmo disparo acertam cada inimigo só uma vez (anel do Sinal do Recreio, flechas do Arco de Régua). Evita que encostar num chefe faça todos acertarem juntos. |
| `glyphs` | — | Texto com caracteres sorteados a cada tiro (ex.: `"0123456789+-×÷"`). |
| `glyphBonus` | — | Multiplicador de dano por caractere (ex.: `{ "×": 2 }`). |
| `sprite` | orb | Aparência: `{ "shape", "color", "accent" }`. |

Formatos de projétil (`shape`): `paper`, `staple`, `eraser`, `clip`, `pencil`, `chalk`, `blob`, `bolt`,
`orb`, `paperball`, `puff`, `protractor`, `glyph`, `ball`, `proton`, `dna`, `plane`, `shaving`, `wave`, `beam`, `seed`.

### `melee`

| Campo | Padrão | O que faz |
|---|---|---|
| `range` | 50 | Alcance do golpe. |
| `arc` | 110 | Abertura do golpe em graus. |
| `knockback` | 150 | Empurrão. |
| `deflect` | false | Corta projéteis inimigos no ar. |
| `reflect` | false | Rebate os projéteis inimigos de volta (mais forte). |

### `effect`

```json
"effect": { "type": "fogo", "chance": 0.35, "duration": 3, "power": 2 }
```

| `type` | O que faz | `power` |
|---|---|---|
| `fogo` | Queima: dano por segundo | dano/s |
| `veneno` | Envenena (acumula duração, até 8 s) | dano/s |
| `gelo` | Deixa lento; `freeze` = chance de congelar | multiplicador de velocidade (0.5 = metade) |
| `choque` | Raio que pula para inimigos próximos (`chains`, `radius`) | dano de cada salto |
| `atordoar` | Atordoa (inimigo fica parado); chefes só ficam lentos | — (use `duration`) |

### Formatos de arma na mão (`sprite.shape`)

`sheets`, `calculator`, `pistol`, `smg`, `shotgun`, `rifle`, `launcher`, `sword`, `bat`, `staff`, `tube`,
`slingshot`, `magnifier`, `extinguisher`, `protractor`, `ball`, `cannon`, `dna_gun`, `bow`, `compass`, `umbrella`,
`backpack`, `sharpener`, `bell`, `projector`, `magnet`. Qualquer outro nome desenha um retângulo com as cores.
Para usar um desenho próprio, veja `client/assets/sprites/LEIA-ME.md` (chave `wpn_<id>`).

## Modos (`mode`)

Cada arma `ranged` escolhe uma mecânica em `mode`. Os parâmetros ficam num bloco com o mesmo nome
(ex.: `"mode": "beam", "beam": { "dps": 18 }`). Campos que faltam usam o padrão. Um campo com nome errado
dentro do bloco é acusado na tela de carregamento.

| `mode` | Como funciona | Campos do bloco (padrão) |
|---|---|---|
| `shot` | Tiro normal (o de sempre). | — |
| `burst` | Cada disparo solta vários tiros seguidos; paga energia uma vez. | `count` (3), `interval` (0.07 s) |
| `charge` | Segure para carregar; solte para atirar. Mais carga = mais dano. | `time` (1 s), `minMul` (0.4), `maxMul` (2.5), `fullPierce` (0), `fullCount` (1), `fullBounce` (0, ricochetes extras na carga cheia) |
| `spinup` | A cadência começa baixa e sobe enquanto segura. | `startMul` (0.35), `maxMul` (1.6), `rampTime` (1.4 s) |
| `beam` | Laser contínuo até a parede ou o primeiro inimigo. Gasta energia por segundo. | `dps` (20), `tick` (0.1), `range` (420), `width` (6), `pierce` (false), `ghost` (false, atravessa paredes), `energyPerSec` (6) |
| `flame` | Cone curto e contínuo de partículas que atravessam inimigos. | `range` (130), `arc` (40°), `particles` (2) |
| `lob` | Arremesso em arco: cai no ponto mirado, por cima de tudo. | `maxRange` (360), `flightTime` (0.6), `peak` (50), `fuse` (0), `bounces` (0), `pool` |
| `split` | O tiro se divide ao bater. | `into` (3), `childDamageMul` (0.5), `spread` (60°) |
| `chain` | Raio instantâneo que pula entre inimigos. | `range` (300), `chains` (3), `radius` (130), `falloff` (0.8), `aimCone` (35°) |
| `deploy` | Coloca no chão uma `mine` (mina) ou `turret` (torreta). | `kind`, `max` (3), `life` (12), `radius` (60), `damage` (12), `fireRate` (2), `range` (220), `triggerRadius` (28) |
| `singularity` | Tiro lento que vira um buraco negro que puxa e machuca. | `pullRadius` (110), `life` (2.5), `dps` (8), `pull` (170) |
| `rain` | Projéteis caem do alto em volta do ponto mirado (com aviso no chão). | `count` (5), `radius` (70), `delay` (0.5), `hitRadius` (26), `maxRange` (380) |
| `orbit` | Os disparos giram em volta do jogador; com o máximo, o próximo disparo lança todos. | `max` (4), `radius` (34), `spin` (4), `launchSpeed` (480) |
| `variants` | Cada disparo sorteia uma variante de projétil. | `list`: lista de projéteis (aceita `damageMul`) |

**Poça (`pool`)**, em `lob.pool` ou `projectile.pool`: `{ "r": 40, "life": 3, "dps": 2, "effect": null, "slowMul": 1, "style": "paint" }`.
`style` muda a cor: `paint`, `acid`, `fire`, `ice`.

Outros campos novos do `projectile`: `glyphSplit` (o caractere que se divide, ex.: `"÷"`) e `growOnReturn`
(bumerangue volta maior, ex.: `1.5`).

## Corpo a corpo (`melee.style`)

| `style` | Como funciona | Bloco dentro de `melee` |
|---|---|---|
| `swing` | Golpe em arco (o de sempre). | — |
| `thrust` | Estocada: avança acertando tudo no caminho, invulnerável durante o avanço. | `thrust`: `distance` (110), `time` (0.16) |
| `combo` | Sequência de golpes; o último é mais forte e mais largo. | `combo`: `steps` (3), `finisherMul` (2), `finisherArcBonus` (40), `resetTime` (0.7) |
| `shield` | Segure para bloquear balas de frente (gasta energia); solte para empurrar. | `shield`: `arc` (110), `blockCost` (1), `speedMul` (0.6), `bashKnockback` (320) |

Para conferir o equilíbrio, rode `node scripts/weapon-dps.mjs`: ele mostra o dano por segundo de cada arma contra
um alvo parado a 120 px e marca as que saem da faixa da raridade. A coluna **encostado** mede a arma grudada (ou
dentro) de um alvo do tamanho de um chefe; ela pode passar do teto da faixa (leques e lança-chamas são melhores de
perto), mas no máximo 1,5 vez. Acima disso a arma aparece como **ROUBADA ENCOSTADO**.

## Exemplo completo

```json
{
  "id": "apagador_turbo",
  "name": "Apagador Turbo",
  "category": "especial",
  "rarity": "rara",
  "type": "ranged",
  "mode": "charge",
  "damage": 5,
  "fireRate": 2,
  "energyCost": 2,
  "critChance": 0.1,
  "inaccuracy": 3,
  "charge": { "time": 0.8, "minMul": 0.4, "maxMul": 2.5, "fullCount": 3 },
  "projectile": { "speed": 400, "radius": 8, "range": 380, "bounce": 1,
                  "sprite": { "shape": "eraser", "color": "#2b2b2b", "accent": "#ffffff" } },
  "effect": { "type": "gelo", "chance": 0.3, "duration": 2, "power": 0.6 },
  "sprite": { "shape": "smg", "color": "#2b2b2b", "accent": "#ffffff" },
  "description": "Segure para carregar: com carga cheia solta 3 nuvens de pó de giz que deixam os inimigos lentos."
}
```
