# Antares: A Masmorra Escolar

Roguelike de ação com visão de cima, no estilo dungeon crawler de tiro, feito em **Phaser 3** para rodar no navegador.
Os heróis são os professores do Ensino Médio do Colégio Antares Americana, e os chefes são a coordenação.
Os sprites são caricaturas carinhosas inspiradas nas fotos públicas de <https://antaresamericana.com.br/ensino-medio/>
(cabelo, óculos, barba e jaleco com a cor da gola).

**Versão 0.3 (em andamento):** armas com mecânicas diferentes e revive novo no co-op. 3 andares, 6 professores liberados, modos solo,
co-op local (2 a 4) e online com salas por código.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
npm install
```

```bash
npm start
```

Abra <http://localhost:3000>. Para trocar a porta: `PORT=8080 npm start`.

```bash
npm test
```

Roda os testes automáticos: geração de mapas, combate, armas, 3 andares, chefes, loja, salas online.

Com o servidor rodando, `node scripts/smoke.mjs` abre o jogo num navegador sem tela (Playwright) e confere menu, partida e armas.

- <http://localhost:3000/galeria.html> mostra todos os sprites e as chaves para trocar por arte própria.

### Publicar no Render (jogar pelo Chromebook, celular etc.)
No Render, crie um **Web Service** ligado a este repositório e preencha:
- **Build:** `npm install`
- **Start:** `npm start`
- **Plano:** Free

O modo online funciona lá, porque o Render aceita WebSocket. No plano grátis, o servidor "dorme" depois de 15 minutos
sem acesso: a primeira visita demora cerca de 1 minuto e as salas abertas se perdem.

## Modos de jogo

- **Jogar solo:** escolha um professor e enfrente os 3 andares.
- **Co-op local (2 a 4):** no lobby, o Jogador 1 usa teclado + mouse.
  - Outro jogador entra apertando **ENTER** (teclado, setas) ou **A** num controle.
  - Cada um escolhe um professor diferente e confirma "pronto".
  - A câmera se afasta para mostrar todo mundo.
- **Online (salas):** digite seu nome e clique em **Criar sala**.
  - Passe o código de 4 letras para até 3 amigos, que entram com **Entrar**.
  - Cada professor só pode ser escolhido uma vez; a partida começa quando todos estiverem prontos.
  - O servidor é quem decide o estado do jogo (posições, vida, inimigos). O cliente suaviza o movimento e
    prevê o seu personagem para não sentir atraso.

## Controles

| Ação | Teclado e mouse | 2º jogador no mesmo teclado | Controle (gamepad) |
|---|---|---|---|
| Mover | W A S D | Setas | Analógico esquerdo |
| Mirar | Mouse | Automática | Analógico direito (ou automática) |
| Atirar | Botão esquerdo | Enter | RT / RB |
| Habilidade | Espaço (ou botão direito) | Shift direito | LT / LB |
| Interagir / pegar / comprar | E | `.` (ponto) | A |
| Trocar arma | Q | `,` (vírgula) | Y |
| Pausar | Esc | Esc | Start |

## O que tem no jogo

- **3 andares**, cada um com 5 a 8 salas além da entrada e do chefe, geradas aleatoriamente:
  1. *Salas de Aula*. Chefe: **A Máquina de Xerox**, com 2 fases.
  2. *Laboratórios e Biblioteca*. Chefe: **Katia**, Orientadora Pedagógica, com 2 fases:
     - "Como você está se sentindo?": anéis que deixam lento, com uma abertura para passar.
     - "Assembleia": uma roda de alunos empurra todos para o centro.
     - "Conversa Particular": puxa um jogador para um círculo fechado.
     - "Divã": cura a Katia até alguém destruí-lo.
  3. *Corredores da Coordenação*. Chefe final: **Samara**, Coordenadora Pedagógica, com 3 fases:
     - "Advertência": leques de papel vermelho.
     - "Caderno Preto": quem é pego fica assinando, sem poder atacar, até um colega chegar perto.
     - "Suspensão": prende um jogador numa cela.
     - Na fase final, o Caderno Preto e a Advertência vêm juntos.
- **Salas no estilo Soul Knight:** cada sala de combate sorteia uma planta, sempre garantindo caminho entre todas
  as portas:
  - **Plantas:** pilares, 6 pilares, paredes em L nos cantos, trincheiras, bloco central, xadrez, colunas ou aberta.
  - **Caixas de papelão destrutíveis**, que seguram tiros e às vezes soltam energia ou moedas.
  - **Barris químicos explosivos**, que explodem em cadeia.
  - **Espinhos de tachinha** que sobem e descem.
  - Móveis do tema (carteiras, bancadas, estantes, cones) e decoração nas paredes (lousa, tabela periódica,
    placar, relógio...).
  - As portas trancam até a última onda acabar.
- **Salas especiais:**
  - **Baú:** sorteia uma arma por raridade.
  - **Cantina:** a Tia da Cantina vende armas, maçã, suco e broche por moedas.
  - **Estátua:** paga moedas por uma bênção permanente (dano, escudo, velocidade, crítico ou recarga).
  - **Enfermaria:** cura o time.
- **Inimigos:**
  - Caderno Zumbi, Prova Voadora, Estojo Raivoso.
  - Lousa Assombrada (torre que atira em 8 direções).
  - Sinal do Recreio (anéis de som).
  - Mochila-Bomba (corre e explode).
  - **Inimigos de elite** (dourados, com o dobro de vida e mais tiros), mais comuns nos andares 2 e 3.
- **6 professores jogáveis**, cada um com arma inicial, habilidade e passivo:

  | Professor | Matéria | Habilidade | Passivo |
  |---|---|---|---|
  | Ana Cláudia | Redação | Nota Mil | +15% de crítico |
  | Harilson | Matemática | Equação (próximo acerto x5) | Armas gastam −25% de energia |
  | Filipe | Ed. Física | Pique (o time fica mais rápido e atira mais rápido) | +3 de vida |
  | Jean Paulo | Física | Campo Gravitacional | Tiros empurram |
  | Marina | Inglês | Grammar Shield (bolha que apaga balas no time todo) | Vogais dão crítico |
  | Vivian | Biologia | Planta Carnívora (torreta) | Regenera vida |

  Os outros 8 também estão liberados: no total são 14 professores jogáveis,
  cada um com arma inicial, habilidade e passivo próprios (detalhe na tela de seleção).
- **53 armas** em `shared/data/weapons.json`, com 5 raridades. Cada arma tem uma mecânica (`mode`):
  - tiro normal, rajada, carregar (segure e solte), aquecimento (acelera enquanto segura);
  - laser contínuo, lança-chamas, raio em cadeia;
  - arremesso em arco (cai onde você mira), chuva sobre o alvo, tiro que se divide, buraco negro;
  - minas e torretas no chão, projéteis em órbita, sorteio de projétil;
  - corpo a corpo: golpe, estocada (avança), combo de 3 golpes e escudo (bloqueia de frente).
  - Efeitos: fogo, gelo, veneno, choque, atordoar; poças no chão; ricochete, perfuração, explosão, teleguiado e bumerangue.
  - Cada jogador carrega 2 armas: **Q** troca, **E** pega. Ao chegar perto de uma arma aparece um card com o modo e os atributos.
  - `node scripts/weapon-dps.mjs` mostra o dano por segundo de cada arma.
- **Recursos:** vida, escudo que regenera, energia e moedas.
  - Revive: no co-op, um jogador caído levanta se um colega ficar parado e sem atirar ao lado dele por 5 segundos.
    Quem estiver caído também levanta ao passar pelo portal para o próximo andar.
  - A partida acaba quando todos caem.

## Como o código está organizado

A lógica do jogo **não depende do Phaser**: fica em `shared/sim/` e roda igual no navegador (solo e co-op local)
e no servidor (online).

```
shared/
  data/                 JSON editáveis: weapons.json, characters.json, enemies.json (andares, inimigos, chefes)
  sim/
    World.js            a partida (passo fixo de 1/60 s, eventos para som e efeitos)
    salas/              gerador de andares (plantas, caixas, barris, espinhos), portas e ondas, itens, loja, estátua
    personagens/        jogador, habilidades, passivos, aliados (planta)
    inimigos/           IA dos inimigos (behaviors.js) e chefes (chefes/xerox.js, katia.js, samara.js)
    armas/              disparo, corpo a corpo e projéteis
    combat.js           dano, críticos, efeitos, explosões, drops
  net/                  protocolo do online (snapshot do estado, buffer de inputs)
server/
  index.js              Express + Socket.io
  RoomManager.js        salas com código, lobby, simulação autoritativa a 60 Hz, envio a 20 Hz
client/src/
  scenes/               Boot, Menu, CharacterSelect, Lobby, OnlineMenu, Game, Hud, Pause, Result
  render/               sprites provisórios gerados por código, tilemap, efeitos
  ui/  input/  audio/   interface, controles (teclado, 2º teclado, 4 controles), som chiptune
  net/                  LocalSession (solo/co-op), OnlineClient e OnlineSession (interpolação + previsão)
test/                   testes (node --test)
docs/ARMAS.md           como criar armas novas pelo JSON
```

## Personalizando

- **Armas novas:** `shared/data/weapons.json`. O guia completo está em [docs/ARMAS.md](docs/ARMAS.md).
- **Inimigos, andares e chefes:** `shared/data/enemies.json`. Lá ficam vida, velocidade, ataques, ondas, chance de
  elite, espinhos e a raridade dos baús.
- **Professores:** `shared/data/characters.json`. Todos os 14 estão com `playable: true` (`false` bloqueia na seleção).
  Para um professor novo, crie a habilidade dele em `shared/sim/personagens/skills.js`.
- **Arte própria:** `client/assets/sprites/LEIA-ME.md`.

## O que falta

- Liberar os 8 professores restantes, com habilidades e aliados:
  - Andréia: Translate.
  - Felipe: Exército Histórico.
  - Gabriela P.: Obra-Prima.
  - Gabriela S.: Linha do Tempo.
  - Rosana: Reação em Cadeia.
  - Tatiane: Clássicos Vivos.
  - Vinícius: Circuito.
  - William: Terremoto.
- Mesa de laboratório (forja: combinar 2 armas) e itens passivos.
- Reconectar no meio de uma partida online; hoje quem cai da conexão sai da partida.
- Testar com controle de verdade e com pessoas jogando, para afinar o balanceamento (hoje foi calibrado com bots).
- Opções de volume e tela cheia.
- Arte final: os sprites atuais são provisórios e podem ser trocados sem mexer no código.
