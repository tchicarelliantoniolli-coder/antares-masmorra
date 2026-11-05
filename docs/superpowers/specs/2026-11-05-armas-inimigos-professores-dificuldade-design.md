# Design: armas com mecânicas, inimigos novos, 14 professores e jogo difícil

Data: 2026-11-05 · Versão alvo: 0.3

## 1. Intenção e porquê

O dono do projeto jogou em dupla com um amigo e achou o jogo **fácil e sem graça**. O motivo é a falta de variedade:

- **Armas:** as 28 armas são o mesmo tiro com números diferentes (velocidade, quantidade, ricochete) ou o mesmo golpe
  em arco. Ele quer armas que deem sensações diferentes na mão, como num dungeon crawler de tiro (laser contínuo,
  armas de carregar etc.).
- **Inimigos:** os inimigos parecem fazer todos a mesma coisa (andar e atirar).
- **Professores:** 8 dos 14 professores aparecem como "Em breve". Todos devem ser jogáveis.
- **Dificuldade:** só jogadores bons devem terminar os 3 andares.
- **Bug do menu:** quando se entra numa tela a partir do menu inicial e se volta, nenhum botão funciona mais.

Sucesso = o dono e o amigo jogam de novo e sentem que cada arma e cada inimigo pede um jeito diferente de jogar, e que
terminar o jogo exige habilidade.

## 2. Metas, não-metas e anti-metas

**Metas**
- Bug do menu corrigido (e a mesma classe de bug nas outras telas).
- Revive novo no co-op (seção 5.1).
- Sistema de armas com mecânicas (modos) reutilizáveis, configuráveis por JSON.
- Todas as 28 armas revisadas; as que já são boas ficam como estão. Cerca de 45 armas no total.
- Arma inicial de cada um dos 14 professores com mecânica própria (os 6 atuais podem mudar).
- Inimigos com mecânicas distintas: os 6 atuais refeitos e cerca de 7 novos; elites com modificadores.
- Os 8 professores bloqueados jogáveis, com habilidade e passivo funcionando, em solo, co-op local e online.
- Dificuldade alta: só jogadores bons terminam; o co-op não pode ser mais fácil que o solo.

**Não-metas (fora desta versão)**
- Andares ou chefes novos (os 3 chefes só ganham ajuste de números).
- Mesa de forja, itens passivos, reconexão online, opções de volume e tela cheia, arte final.

**Anti-metas (falha mesmo que "funcione")**
- Armas novas que, na prática, são só números diferentes de uma arma existente.
- Dificuldade "injusta": dano alto sem aviso visual, balas impossíveis de desviar, inimigos que atacam sem animação
  de preparo. Todo ataque perigoso precisa de *telegraph* (aviso) visível.
- Quebrar o modo online: tudo que é novo precisa aparecer certo para os outros jogadores.
- Copiar nomes, arte ou armas específicas de outro jogo. As mecânicas são genéricas do gênero; nomes e visual seguem o
  tema escolar do Antares.

## 3. Restrições

- **A lógica vive em `shared/sim/` e não depende do Phaser.** Ela roda igual no navegador (solo e co-op local) e no
  servidor (online, autoritativo a 60 Hz, envio a 20 Hz). Toda mecânica nova entra ali.
- **Modo online:** o estado vai pelo snapshot (`shared/net/snapshot.js`). Tudo que o renderizador precisa desenhar
  (raios, carga, escudo, inimigo enterrado, elos do circuito etc.) precisa estar no snapshot. O cliente prevê o
  próprio jogador (`client/src/net/OnlineSession.js`).
- **Input:** hoje é `{ moveX, moveY, aim, fire, skill, interact, swap }`. `fire` é estado (segurando). O formato é
  sanitizado em `shared/net/InputBuffer.js`.
- **Dados editáveis:** armas em `shared/data/weapons.json` (com validação em `shared/sim/data.js`), inimigos e andares
  em `shared/data/enemies.json`, professores em `shared/data/characters.json`. O guia `docs/ARMAS.md` deve continuar
  válido e ser atualizado.
- **Sprites provisórios gerados por código** (`client/src/render/*Art.js`, `SpriteFactory.js`). Tudo novo ganha
  sprite procedural e chave substituível (ver `client/assets/sprites/LEIA-ME.md`).
- **Testes:** `node --test`. Os testes atuais precisam continuar passando (ajustar os que dependem de números
  rebalanceados).
- Textos do jogo em português do Brasil.

## 4. Abordagens consideradas

| | Abordagem | Troca |
|---|---|---|
| **A (escolhida)** | Mecânicas reutilizáveis escritas uma vez no código; cada arma escolhe a sua por um campo `mode` no JSON e ajusta parâmetros. Inimigos idem: comportamentos novos no código, combinados no JSON. | Criar arma nova continua sem programar; online funciona pela lógica compartilhada. Uma arma muito única exige criar um modo novo. |
| B | Cada arma com uma função própria em código. | Liberdade total, mas perde a edição por JSON, repete código e aumenta bugs no online. |
| C | A, mais um gancho de código opcional por arma. | Dois jeitos de fazer a mesma coisa; só vale se A não der conta. |

O dono escolheu **A**.

## 5. O que foi decidido, por etapa

Ordem de entrega combinada: cada etapa é jogável e é entregue (commit + push) separadamente.

### 5.1 Etapa 1: bug do menu e revive novo

**Bug do menu.** `MenuScene.go()` faz `this.leaving = true` (`client/src/scenes/MenuScene.js:118`). O Phaser reaproveita a
instância da cena, e `create()` não volta `leaving` para `false`; depois de voltar ao menu, todo clique é ignorado.
- Resetar o estado da cena no começo de `create()` (`leaving`, `controls`).
- Conferir o mesmo padrão nas outras cenas (`LobbyScene.started`, `GameScene.ended`/`menuOpen`, `CharacterSelectScene`,
  `ResultScene`, `PauseScene`) e nos listeners de teclado registrados com `on` (que podem acumular a cada visita).

**Revive (decisão do dono).**
- Quem caiu levanta quando um colega fica **parado e sem atirar por 5 segundos** ao lado dele (raio `REVIVE_RADIUS`).
- *Escolha minha:* se o colega se mexer ou atirar, o progresso **volta a zero**.
- Continua valendo: quem estiver caído levanta ao passar pelo portal para o próximo andar (já existe em
  `World.completeFloor`).
- O anel de progresso no HUD/mundo continua; precisa indicar "fique parado".

### 5.2 Etapa 2: sistema de armas

**Modos de disparo** (campo `mode`; ausente = `shot`, o comportamento de hoje). Cada modo tem os próprios parâmetros
num bloco com o mesmo nome no JSON; os nomes exatos dos parâmetros ficam a cargo do construtor.

| `mode` | Como funciona | Parâmetros principais |
|---|---|---|
| `shot` | Tiro atual (inclui leque, ricochete, perfuração, bumerangue, teleguiado, explosão). | os de hoje |
| `burst` | Cada disparo solta N tiros seguidos com intervalo curto. | `count`, `interval` |
| `charge` | Segura para carregar e solta ao largar o botão. Mais carga = mais dano, velocidade e perfuração. Carga total brilha. Carregar parcialmente solta tiro fraco. | `time`, `minMul`, `maxMul`, `fullBonus` |
| `spinup` | A cadência começa baixa e sobe enquanto segura; cai ao soltar. | `startMul`, `maxMul`, `rampTime` |
| `beam` | Laser contínuo enquanto segura: raio instantâneo do jogador até a parede ou o primeiro inimigo (ou atravessa, se `pierce`). Dano por tique; energia por segundo. | `dps`, `tick`, `range`, `width`, `pierce`, `energyPerSec` |
| `flame` | Cone curto e contínuo de partículas que queimam/congelam; atravessa inimigos, não paredes. | `range`, `arc`, `particles` |
| `lob` | Arremesso em arco: cai **no ponto mirado** (limitado ao alcance) passando por cima de obstáculos e inimigos; explode ao cair ou depois de quicar/um tempo; pode deixar poça. Mostra uma sombra/alvo onde vai cair. | `maxRange`, `flightTime`, `fuse`, `explode`, `pool` |
| `split` | O tiro se divide em vários menores ao acertar algo (inimigo ou parede). | `into`, `childDamageMul`, `spread` |
| `chain` | Raio instantâneo que acerta o inimigo mais próximo da mira e pula entre vizinhos. | `chains`, `radius`, `falloff` |
| `deploy` | Coloca algo no chão: **mina** (explode quando inimigo passa) ou **torreta** (atira sozinha por um tempo). Limite de objetos por jogador. | `kind`, `max`, `life`, parâmetros do objeto |
| `singularity` | Projétil lento que, ao parar, vira um buraco negro que puxa e machuca (reaproveitar a área `gravity`). | `pullRadius`, `life`, `dps` |
| `rain` | Faz cair projéteis do alto numa área em volta do ponto mirado, com aviso no chão. | `count`, `radius`, `delay` |
| `orbit` | Os disparos ficam girando em volta do jogador (escudo que bate) e saem na direção da mira no disparo seguinte ou quando o limite enche. | `max`, `radius`, `launchSpeed` |
| `variants` | Cada disparo sorteia uma variante de uma lista; cada variante é um tiro com parâmetros próprios. | `variants: [...]` |

**Corpo a corpo** (`type: "melee"`, campo `melee.style`):

| `style` | Como funciona |
|---|---|
| `swing` | Golpe em arco atual (com `deflect`/`reflect`). |
| `thrust` | Estocada: avança alguns tiles na direção da mira, acerta o que estiver na linha, com breve invulnerabilidade durante o avanço. |
| `combo` | Sequência de 3 golpes; o 3º é mais forte e mais largo. A sequência zera se parar de atacar. |
| `shield` | Enquanto segura, levanta um escudo à frente que bloqueia balas (gasta energia por bala bloqueada) e anda mais devagar; ao soltar, dá um empurrão. |

**Input novo.**
- `aimDist`: distância do ponto mirado ao jogador. Mouse: distância real. Controle e 2º teclado: distância padrão
  (cerca de 200 px) ou a do inimigo mirado pela mira automática. Sanitizado e limitado no `InputBuffer`.
- A simulação detecta "soltou o botão" comparando `fire` com o valor do passo anterior (necessário para `charge`).

**Estado novo no snapshot/render:** carga atual, nível de `spinup`, raios ativos (`beam`, `chain`) como segmentos,
escudo levantado, projéteis em órbita, objetos colocados (minas/torretas) e a altura/alvo dos `lob`. O card da arma
(`client/src/ui/WeaponCard.js`) mostra o nome do modo em português (ex.: "Laser contínuo", "Carregar").

**Armas iniciais (escolha minha, autorizada pelo dono).** Todas custam 0 de energia.

| Professor | Arma inicial | Modo |
|---|---|---|
| Ana Cláudia | Folhas de Redação Afiadas | `burst` (3 folhas que perfuram) |
| Harilson | Números e Sinais | `shot` com sinais: mantém × (dobro) e o novo ÷, que se divide em 2 ao acertar |
| Filipe | Bolas de Vários Esportes | `variants`: basquete (quica muito), futebol (rápida), boliche (lenta, perfura, empurra) |
| Jean Paulo | Canhão de Prótons | `beam` (laser fino de prótons) |
| Marina | Arco do Alfabeto | `charge` (vogais continuam crítico garantido) |
| Vivian | Lançador de DNA e Células | `split` (mitose: a célula se divide ao acertar) |
| Andréia | Balões de Fala (English!) | `orbit` (balões giram em volta e são lançados) |
| Felipe | Catapulta Medieval em Miniatura | `lob` (pedra que explode ao cair) |
| Gabriela P. | Pincel de Poças de Tinta | `shot` que deixa poça de tinta que deixa lento |
| Gabriela S. | Pergaminhos e Lança Romana | melee `thrust` |
| Rosana | Frascos Químicos Explosivos | `lob` com poça de ácido (veneno) |
| Tatiane | Livro Mágico | `rain` (páginas caem sobre o alvo) |
| Vinícius | Raios Elétricos | `chain` |
| William | Globo Terrestre Bumerangue | `shot` com bumerangue que perfura e cresce na volta |

**Revisão das 24 armas que não são iniciais** (intenção; números ficam com o construtor):

| Arma | Decisão |
|---|---|
| Pistola de Grampos | Fica como está (arma básica). |
| Metralhadora de Borrachas | `spinup`. |
| Escopeta de Clipes | Fica (escopeta já é distinta). |
| Rifle de Lápis | `charge` (tiro de precisão; carga total perfura tudo). |
| Régua-Espada | Melee `combo`. |
| Taco de Beisebol | Fica `swing`; rebate balas (`reflect`). |
| Tubo de Ensaio de Ácido | `lob` com poça de veneno. |
| Cajado de Tesla | `chain`. |
| Estilingue de Elástico | `charge` curto, com ricochete na carga total. |
| Lança-Mísseis de Giz | `burst` de mísseis teleguiados que explodem. |
| Lupa Solar | `beam` que queima. |
| Extintor de Incêndio | `flame` com gelo. |
| Bumerangue de Transferidor | Fica (bumerangue). |
| Compasso-Lança | Melee `thrust`. |
| Guarda-Chuva | Melee `shield`. |
| Mochila Pesada | Fica `swing` pesado. |
| Aviões de Papel Teleguiados | Fica (teleguiado). |
| Arco de Régua Flexível | `charge` com 3 flechas na carga total. |
| Apontador que Tritura | `deploy` torreta que solta raspas. |
| Sinal do Recreio | `shot`: anel de ondas que perfura tudo em 360°. |
| Projetor de Slides | `beam` largo que atravessa inimigos. |
| Ímã Gigante | `singularity`. |

**Armas novas (cerca de 17).** Nomes e raridades são sugestão; o construtor pode ajustar, mantendo um modo por arma e
o tema escolar.

| Arma | Modo | Raridade |
|---|---|---|
| Caneta Laser | `beam` | rara |
| Bico de Bunsen | `flame` (fogo) | rara |
| Granada de Giz | `lob` | incomum |
| Grampeador Automático | `burst` 4 | comum |
| Perfuradora de Folhas | `spinup` | épica |
| Tachinhas no Chão | `deploy` mina | incomum |
| Ventilador de Teto | `deploy` torreta | épica |
| Mini Buraco Negro | `singularity` | lendária |
| Bola de Papel Divisora | `split` | incomum |
| Tesoura sem Ponta | melee `combo` | comum |
| Escudo de Prancheta | melee `shield` | rara |
| Mastro da Bandeira | melee `thrust` | incomum |
| Chuva de Provas | `rain` | épica |
| Elétrons em Órbita | `orbit` | épica |
| Canhão de Confete | `burst` em leque | comum |
| Diapasão | `chain` sônico que atordoa | rara |
| Raio-X do Laboratório | `beam` que perfura tudo e atravessa paredes | lendária |

### 5.3 Etapa 3: inimigos

**Princípio:** cada inimigo pede uma resposta diferente do jogador (desviar, chegar perto, fugir, priorizar). Todo
ataque tem aviso visual.

**Inimigos atuais refeitos**

| Inimigo | Mecânica nova |
|---|---|
| Caderno Zumbi | Mantém o bote; o bote deixa um rastro de tinta que deixa lento. Chega em grupos. |
| Prova Voadora | Mira **à frente** do jogador (prevê o movimento); rajada de 3. |
| Estojo Raivoso | Fica **fechado e invulnerável** (escudo) e só abre para soltar o leque; a janela aberta é a hora de bater. |
| Lousa Assombrada | Padrão em **espiral giratória**, não mais anéis estáticos. |
| Sinal do Recreio | Mantém os anéis com abertura; anéis alternam velocidade. |
| Mochila-Bomba | Corre em zigue-zague; ao explodir deixa fogo no chão por alguns segundos. |

**Inimigos novos**

| Inimigo | Mecânica | Andares |
|---|---|---|
| Borracha Divisora | Ao morrer, divide-se em 2 menores (que se dividem mais uma vez). | 1-3 |
| Grampeador Touro | Mira, avisa com uma linha no chão e dispara uma investida longa; bate na parede e fica tonto. | 1-3 |
| Régua Mira-Laser | Atirador de longe: mostra uma linha laser por ~1 s antes do tiro rápido e forte. | 2-3 |
| Apontador Escavador | Some no chão, persegue por baixo e surge sob o jogador (círculo de aviso). | 2-3 |
| Monitor de Turma | Invocador: fica longe e chama 2-3 minis periodicamente. Prioridade de abate. | 2-3 |
| Grêmio Estudantil | Dá escudo/cura aos inimigos próximos (linha visível); foge do jogador. | 3 |
| Chamada Fantasma | Teleporta perto do jogador (aviso), solta rajada e some de novo. | 3 |

**Elites com modificadores.** Além de mais vida e tiros, cada elite sorteia um modificador visível (cor/ícone):
rápido, blindado (escudo inicial), explosivo ao morrer, vampiro (cura ao acertar), duplicador (invoca cópia ao chegar
a 50% de vida). A lista é sugestão; o construtor pode ajustar.

**Andares.** Cada andar tem um conjunto próprio de inimigos (`enemyPool` em `enemies.json`) e combinações de onda
que misturem papéis (ex.: tanque + atirador + invocador).

### 5.4 Etapa 4: os 8 professores

Seguir as habilidades e passivos já descritos em `characters.json`, todos com `playable: true`. Aliados invocados
reaproveitam e generalizam `shared/sim/personagens/Allies.js`.

| Professor | Habilidade (como vai funcionar) | Passivo |
|---|---|---|
| Andréia | **Translate:** inimigos num raio ficam confusos por ~4 s: andam até o inimigo mais próximo e as balas deles ferem inimigos. Chefes ficam só lentos. | Bilíngue (já existe: 20% de disparo duplo). |
| Felipe | **Exército Histórico:** invoca 3 aliados por ~10 s: legionário (corpo a corpo, segura inimigos), cavaleiro (investida), bandeirante (atira). | **Estrategista:** aliados duram 50% mais (implementar). |
| Gabriela P. | **Obra-Prima:** pinta uma área grande no chão por ~6 s que deixa os inimigos em cima muito lentos. | **Paleta Viva:** poças de tinta (da arma e da habilidade) ganham fogo, gelo ou veneno aleatório (implementar). |
| Gabriela S. | **Linha do Tempo:** volta posição, vida e escudo de todo o time para como estavam 3 s antes. *Escolha minha:* um colega que estava de pé há 3 s e caiu levanta. | Memória Histórica (já existe: +1 escudo; implementar "regenera mais rápido"). |
| Rosana | **Reação em Cadeia:** por ~6 s, cada inimigo que ela acerta explode e machuca os vizinhos, que também explodem (cada inimigo explode uma vez). | Imunidade (já existe). |
| Tatiane | **Clássicos Vivos:** invoca 3 personagens por ~10 s: Capitu (atira e encanta, deixando lento), Macunaíma (rápido, corpo a corpo), Policarpo Quaresma (fica parado, atira em leque). | Leitura Dinâmica (já existe). |
| Vinícius | **Circuito:** liga até 6 inimigos próximos por ~6 s (linhas elétricas visíveis). *Escolha minha:* o dano que um recebe é repassado em 50% para cada outro ligado. Atualizar a descrição no JSON. | **Alta Voltagem:** 15% de chance de choque em qualquer arma (implementar). |
| William | **Terremoto / Vulcão:** *escolha minha:* alterna a cada uso. Terremoto atordoa todos os inimigos da sala por ~1,5 s e causa dano; Vulcão abre uma área na mira que cospe lava por alguns segundos. O HUD mostra qual é o próximo. | Cartógrafo (já existe). |

Sprites: os 14 professores já têm aparência definida (`visual` em `characters.json`). Faltam sprites para aliados
novos, objetos de habilidade e projéteis das armas iniciais novas.

As telas de seleção (solo, lobby local e online) passam a mostrar os 14 professores sem "Em breve".

### 5.5 Etapa 5: dificuldade

**Alvo (decisão do dono):** só jogadores bons terminam os 3 andares. Ele jogou em dupla, então o co-op precisa ficar
tão difícil quanto o solo.

**Alavancas** (os números finais ficam com o construtor, guiados pelos bots):
- Dano dos inimigos: ataques fortes e chefes passam a tirar 2; no andar 3, mais ataques tiram 2.
- Balas mais rápidas e ondas maiores, com mais elites (`eliteChance`) e `hpScale` maior nos andares 2 e 3.
- Chefes com mais vida e ataques mais frequentes.
- Escala por jogador também nos inimigos comuns (mais inimigos por onda e mais vida por jogador extra), não só nos chefes.
- Cura mais rara: menos drops de vida, loja e estátua mais caras, enfermaria cura menos.
- Escudo do jogador demora mais a regenerar.

**Calibração com bots.** Não existe hoje um bot de teste. Criar um bot sem interface (Node) que joga uma partida
completa: anda até os inimigos, mira e atira, desvia de balas próximas com qualidade configurável (tempo de reação e
precisão), pega armas e itens, usa a habilidade. Rodar várias sementes em dois níveis:
- bot "bom": termina em poucas sementes (cerca de 20-35%);
- bot "médio": morre em geral no andar 2.

O teste definitivo é o dono e o amigo jogarem. Depois da etapa 5, ajustar os números conforme o que eles acharem.

## 6. Testes esperados

- Os testes atuais passam (ajustando os que dependem de números rebalanceados).
- Cada modo de arma e estilo de corpo a corpo tem teste de simulação (ex.: `beam` acerta inimigo na linha e para na
  parede; `charge` solta ao largar; `lob` cai no ponto mirado).
- Cada inimigo novo e cada habilidade nova tem teste básico de comportamento.
- Validação de dados: `mode` e parâmetros desconhecidos geram erro legível na tela de carregamento e no `npm test`.
- Snapshot online: o estado novo sobrevive a `serializeWorld` → `decodeSnapshot`.
- Revive: o progresso só sobe com o colega parado e sem atirar, e zera se ele se mexer.
- O bot de calibração fica num script separado (lento demais para todo `npm test`), com um teste curto que só confere
  que ele roda.

## 7. O que fica com o construtor

- Nomes exatos dos parâmetros de cada modo e os números de todas as armas, inimigos e andares.
- Arte procedural, efeitos visuais e sons das coisas novas.
- Nomes, raridades e a lista final das armas novas, respeitando um modo por arma e o tema escolar.
- Lista final de modificadores de elite.
- Como dividir cada etapa em tarefas e commits.
- Atualizar `README.md` e `docs/ARMAS.md`.
