# Como são montadas as salas (formas, layouts, objetos e decoração)

Cada andar é gerado por `shared/sim/salas/DungeonGenerator.js` (roda no navegador e no servidor, sem Phaser).
Tudo que o cliente desenha da sala vem do mapa serializado (`TileMap`: tiles, tema, props, espinhos, decoração) e
da lista de salas (`r.shape`, `r.layout`, `r.theme`...). A mesma semente gera sempre o mesmo andar: todo sorteio
usa o `rng` da partida.

| Arquivo | O que faz |
|---|---|
| `shared/data/themes.json` | Cenário de cada tema: layouts (com peso), objetos quebráveis (com peso), decoração de parede, luz, partículas, decalques. E as formas das salas de combate. |
| `shared/sim/salas/kinds.js` | Lista oficial de nomes (layouts, formas, objetos, decorações com a largura). O JSON só pode usar estes nomes (o `npm test` confere). |
| `shared/sim/salas/formas.js` | As formas das salas de combate (recortes em parede). |
| `shared/sim/salas/layouts.js` | Os layouts de combate (onde ficam carteiras, estantes, pilares...) e a mobília das salas especiais. |
| `shared/sim/salas/DungeonGenerator.js` | Monta o andar: grade de salas, corredores, forma, layout, objetos, espinhos, decoração, ondas. |

## Formas das salas de combate

A sala é sempre um retângulo na grade (`x0, y0, w, h`, com tamanhos ímpares: o centro `cx, cy` é exato) e as
**portas ficam no meio de cada lado**. A forma "come" pedaços do interior com `T.WALL` (no tema da sala). Regras
que valem para todas as formas:

- a **cruz central fica livre**: os cortes nunca entram em `|dx| <= 2` nem `|dy| <= 2` (relativos ao centro).
  Assim as 4 portas sempre desembocam em chão que leva ao centro, e o centro é sempre chão;
- nenhum corte toca a boca das portas nem os corredores;
- as salas especiais (entrada, chefe, baú, enfermaria, estátua, cantina) continuam retangulares.

| Forma | Como fica |
|---|---|
| `retangulo` | A sala inteira, sem cortes. |
| `cantos_cortados` | Os 4 cantos chanfrados em escada (3 ou 4 tiles). |
| `L` | Um canto inteiro vira parede (sorteado). As duas portas desse canto ficam livres. |
| `cruz` | Os 4 cantos viram parede; sobram dois braços cruzados. |
| `T` | Dois cantos do mesmo lado viram parede (lado sorteado): uma barra larga e uma "haste". |

Os pesos ficam em `themes.json` → `"shapes": { "combat": { "retangulo": 3, "L": 2, ... } }`. Para uma forma
aparecer menos, baixe o peso; peso 0 (ou tirar a forma da lista) desliga. Se `shapes.combat` faltar, todas as
salas são retângulos.

O sorteio da forma vem **antes** do layout: o layout é desenhado dentro do que sobrou da sala, e o gerador só
aceita o resultado se todas as portas continuarem ligadas, ≥ 90% do chão for alcançável e sobrar chão
suficiente (≥ 60% do que a forma deixou e pelo menos 70 tiles). Se não der, tenta o próximo layout.

`r.shape` vai junto das salas no mapa online (`serializeMap`); o cliente já recebe a forma, e quem quiser
desenhar a planta no minimapa pode usá-la.

## Layouts de combate

Os layouts são desenhados em `layouts.js`, com `(dx, dy)` relativos ao centro. Móveis (`T.OBSTACLE`) são
cobertura: bloqueiam o andar e as balas, mas o desenho do tile vem do tema (carteira na sala de aula, bancada no
laboratório, estante na biblioteca, cone na quadra, canteiro no pátio). Paredes (`T.WALL`) são só dos layouts
geométricos e da divisória da `sala_dupla`.

| Layout | Descrição |
|---|---|
| `aberto` | Sem nada (só objetos e espinhos). |
| `pilares`, `pilares6`, `cantos`, `trincheiras`, `centro`, `xadrez`, `colunas` | Os layouts geométricos de sempre, em parede. |
| `carteiras` | Sala de aula: fileiras de carteiras (duplas) com corredor central e corredores entre as fileiras; às vezes falta uma carteira. |
| `carteiras_u` | Carteiras em U em volta do centro, aberto para um lado sorteado. |
| `bancadas` | Laboratório: ilhas de bancada de 3 a 4 tiles em formatos variados, uma ou duas por quadrante. |
| `ilhas` | Quatro ilhas grandes (3x2 ou 4x2), uma em cada quadrante. |
| `estantes` | Biblioteca: corredores de estantes (pilhas de 2 tiles) com passagem nas pilhas longas. |
| `quadra` | Meio livre; traves (postes) nas pontas, em volta das portas, e bancos nas laterais. |
| `canteiros` | Pátio: canteiros em anel em volta do centro (4 aberturas), mais vasos nos cantos. |
| `mesas_longas` | 2 ou 3 mesas longas (horizontais ou verticais), com o meio livre. |
| `sala_dupla` | Uma divisória central (parede) com passagem no meio, horizontal ou vertical. |

Como o sorteio funciona (`layoutOrder`): os layouts do tema entram em ordem de **sorteio ponderado sem repetição**
(peso de `combatLayouts`); depois vêm os geométricos que sobraram e, por último, os temáticos dos outros cenários.
O gerador usa o primeiro que passa na verificação de conectividade; `aberto` é o último recurso.

## Objetos quebráveis e decoração de parede

- **Objetos** (`themes.json` → `props`, com pesos): cada grupo de 1 a 3 objetos sorteia um `kind` do tema
  (`mochila`, `pilha_livros`, `caixa_tubos`, `cesto_bolas`, `vaso`, `pilha_papeis`, `bandeja`, `caixa`). Todos agem
  como a caixa: 4 de vida, quebram com tiro/golpe/explosão e às vezes soltam energia ou moedas. O `barril` não faz
  parte do tema: continua sorteado à parte (2 de vida, explode). O cliente desenha o sprite `prop_<kind>`.
- **Decoração** (`themes.json` → `wallDecor`): peças presas na parede de cima, sem colisão, com a largura de
  `DECOR_WIDTH` (em tiles). Salas de combate têm 2 a 4 peças, as especiais 2 a 3 e o chefe 3 a 5, sem sobreposição
  e com 1 tile de folga. **Toda sala** tem 1 ou 2 `lampada` (as lâmpadas e janelas acendem uma luz no cliente).
  Só entram trechos de parede que tenham chão logo abaixo; numa forma sem parede de cima suficiente, as peças que
  não cabem são trocadas por outras mais estreitas do tema.

## Salas especiais (retangulares)

| Sala | Composição | Deixa livre |
|---|---|---|
| Entrada | Armário/banco em L nos 4 cantos. | Centro (onde os jogadores nascem) e as portas. |
| Baú | 4 colunas baixas a 2 tiles do baú e 4 pilares ao fundo. | O baú no centro e o caminho até ele. |
| Enfermaria | Macas encostadas nas paredes, nos 4 cantos. | A estação de cura no centro e as portas. |
| Estátua | Anel de pedestais em volta da estátua (raio 3). | O centro e as aberturas do anel. |
| Cantina | Estantes de mercadorias nas laterais (o balcão e a tia da cantina vêm do `RoomDirector`). | A faixa onde ficam os 4 itens à venda. |
| Chefe | Arquibancadas só junto às paredes laterais (+ os pilares do andar, se `bossPillars`). | O centro e o portal (`cy + 2`). |

## Como criar uma sala nova (um layout novo)

1. Em `kinds.js`, **acrescente** o nome em `LAYOUT_NAMES` (nunca renomeie os existentes).
2. Em `layouts.js`, acrescente uma função em `LAYOUTS` com o mesmo nome. Ela recebe um contexto `c` com:
   `c.at(dx, dy, tipo)`, `c.box(dx0, dy0, dx1, dy1, tipo)`, `c.quad(...)` (retângulo espelhado nos 4 quadrantes),
   `c.each4((sx, sy) => ...)`, `c.sym4([[dx, dy], ...], tipo)`, `c.rng` (use sempre ele, nunca `Math.random`),
   `c.hw` / `c.hh` (meia largura/altura do interior). `tipo` padrão é `T.OBSTACLE`; use `T.WALL` para parede.
   As posições que caem na boca das portas, na borda da sala ou em cima de parede são recusadas sozinhas.
3. Deixe o centro livre (o teste exige, exceto no layout `centro`) e prefira corredores de 2 tiles ou mais.
4. Use o nome em `themes.json` → `combatLayouts` de algum tema, com um peso.
5. Rode `npm test`: `test/rooms.test.js` confere que o layout existe, que não bloqueia o centro nem as portas e
   que todos os temas usam pelo menos 2 dos seus layouts.

## Como criar um tema novo

1. Acrescente o nome em `THEMES` (`shared/sim/constants.js`), os rótulos em `THEME_LABELS` e a arte dos tiles
   no cliente (ver `client/src/render`).
2. Em `themes.json` → `themes`, crie o bloco do tema com `label`, `combatLayouts`, `props`, `wallDecor`,
   `ambient`, `particles` e `decals` (só nomes que existem em `kinds.js`).
3. Para o tema aparecer em salas de combate, coloque-o em `themes` do andar em `enemies.json`
   (`floors[n].themes`). A entrada, a enfermaria, a cantina, a estátua e o chefe usam temas fixos (`DungeonGenerator.buildFloor`).
4. Se precisar de uma decoração, objeto ou forma que não existe: **acrescente** o nome em `kinds.js`, implemente
   nos dois lados (gerador e cliente) e só então use no JSON.

## Para quem for mexer no gerador

- `generateFloor({ rng, floorDef, data })`: `data` é o `GameData` (usa `data.themes` e `data.roomShapes`). Também
  aceita `themes` e `shapes` soltos. Sem esses dados o gerador usa retângulos, os layouts geométricos e caixas.
- Em testes, `limparSala(world, sala)` (`test/helpers.js`) deixa a sala só com chão; `arena()` já faz isso.
- `RoomDirector.freeCells` só devolve `T.FLOOR` e, em salas com forma, tira os tiles colados nas paredes dos cortes.
  `isInsideRoom` continua valendo o retângulo envolvente: os cortes são parede e as portas ficam dentro dele.
