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
| `damage` | sim | Dano de cada projétil / golpe. |
| `fireRate` | sim | Disparos por segundo. |
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

## Exemplo completo

```json
{
  "id": "apagador_turbo",
  "name": "Apagador Turbo",
  "category": "especial",
  "rarity": "rara",
  "type": "ranged",
  "damage": 4,
  "fireRate": 3,
  "energyCost": 2,
  "critChance": 0.1,
  "inaccuracy": 5,
  "projectile": { "speed": 400, "radius": 8, "range": 380, "count": 3, "spread": 20, "bounce": 1,
                  "sprite": { "shape": "eraser", "color": "#2b2b2b", "accent": "#ffffff" } },
  "effect": { "type": "gelo", "chance": 0.3, "duration": 2, "power": 0.6 },
  "sprite": { "shape": "smg", "color": "#2b2b2b", "accent": "#ffffff" },
  "description": "Três nuvens de pó de giz que deixam os inimigos lentos."
}
```
