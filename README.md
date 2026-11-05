# Antares: A Masmorra Escolar

Roguelike de ação com visão de cima (estilo "dungeon crawler" de tiro), feito em **Phaser 3**, para rodar no
navegador. Os heróis são os professores do Ensino Médio do Colégio Antares Americana, e os chefes são a
coordenação. Os sprites são caricaturas carinhosas inspiradas nas fotos públicas da página
<https://antaresamericana.com.br/ensino-medio/> (cabelo, óculos, barba e jaleco com a cor da gola).

> **Etapa atual: 1 — MVP.** 1 andar, 2 personagens jogáveis, 15 armas, 3 tipos de inimigo e 1 chefe, só no modo solo.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
npm install
```

```bash
npm start
```

Abra <http://localhost:3000> no navegador. Para usar outra porta: `PORT=8080 npm start`.

Outros comandos:

```bash
npm test
```

Roda os testes automáticos da lógica do jogo (geração de andares, combate, armas, chefe, revive).

- <http://localhost:3000/galeria.html> mostra todos os sprites provisórios e as chaves para trocar por arte própria.

## Controles

| Ação | Teclado e mouse | Controle (gamepad) |
|---|---|---|
| Mover | W A S D (ou setas) | Analógico esquerdo |
| Mirar | Mouse | Analógico direito (sem mira = mira automática) |
| Atirar | Botão esquerdo (segurar) | RT / RB |
| Habilidade | Espaço (ou botão direito) | LT / LB |
| Interagir / pegar arma | E | A |
| Trocar arma | Q | Y |
| Pausar | Esc | Start |
| Som liga/desliga | M | — |

## O que já tem (Etapa 1)

- **Loop completo:** menu → seleção de personagem (cards dos 14 professores) → andar gerado aleatoriamente →
  salas com portas que trancam até matar todos os inimigos (2–3 ondas) → sala do baú → chefe → portal → vitória.
- **Andar com 5 a 8 salas** ligadas por corredores, temas da escola (sala de aula, laboratório, quadra,
  biblioteca, pátio, secretaria) e carteiras/estantes/cones como obstáculos. O chefe fica sempre no fim de um caminho.
- **Salas especiais:** baú (sorteia arma por raridade) e enfermaria (cura o time; aparece em andares com 7+ salas).
- **Recursos:** vida, escudo que regenera após 4 s sem dano, energia (armas gastam; inimigos derrubam energia).
  Moedas já caem (a loja chega na Etapa 3). Maçã do professor recupera 2 de vida.
- **Personagens jogáveis:**
  - **Ana Cláudia (Redação)** — Folhas de Redação Afiadas (atravessam 1 inimigo). Habilidade **Nota Mil**: um "1000"
    gigante que atravessa a tela, paredes e inimigos e apaga projéteis. Passivo **Caneta Vermelha**: +15% crítico.
  - **Harilson (Matemática)** — Números e Sinais (o sinal × dá dano dobrado). Habilidade **Equação**: o próximo
    inimigo atingido leva dano x5. Passivo **Cálculo Mental**: armas gastam 25% menos energia.
  - Os outros 12 já aparecem na seleção, com visual, habilidade e passivo descritos (bloqueados até a Etapa 3).
- **15 armas** com tema escolar em `shared/data/weapons.json` (2 iniciais + 13 de baú/drop), com raridades e
  cores, dano, cadência, energia, crítico, imprecisão e efeitos: fogo (Lupa Solar), gelo (Extintor), veneno
  (Tubo de Ácido), choque (Cajado de Tesla), ricochete (Borrachas, Estilingue), perfuração (Rifle de Lápis),
  explosão (Lança-Mísseis de Giz), bumerangue (Transferidor) e corpo a corpo que corta/rebate balas
  (Régua-Espada, Taco de Beisebol). 2 armas por jogador, **Q** troca, **E** pega (a atual fica no chão).
  **Card da arma** aparece ao chegar perto dela.
- **Inimigos:** Caderno Zumbi (persegue e dá bote), Prova Voadora (mantém distância e atira papel),
  Estojo Raivoso (leque de lápis).
- **Chefe do Andar 1: A Máquina de Xerox** — 2 fases. "Cópia em Massa" (anéis de papel), "Atolamento de Papel"
  (investida com aviso; se bater na parede fica atordoada), "Toner Derramado" (poças que deixam lento) e,
  na fase 2, "Espiral de Papel" e "Cópias Piratas" (invoca Provas Voadoras).
- **Interface:** menu, tela de controles, seleção com cards, HUD (vida/escudo/energia, 2 armas, habilidade com
  recarga, moedas), minimapa, barra do chefe, avisos, pausa, telas de vitória e derrota.
- **Áudio:** efeitos sonoros e músicas chiptune sintetizados no navegador (menu, masmorra, chefe, vitória, derrota).
- **Controle (gamepad)** com mira automática.
- **Já preparado para o co-op:** a lógica de jogador caído + revive (colega perto por 3 s) e "todos caídos = derrota"
  já existe e tem teste; inimigos e chefe escalam com o número de jogadores.

## Como o código está organizado

A lógica do jogo **não depende do Phaser**: fica em `shared/sim/` e roda igual no navegador e no Node.
Isso deixa a Etapa 2 simples — o servidor vai rodar a mesma simulação e ser a autoridade do estado.

```
shared/
  data/                 JSON editáveis: weapons.json, characters.json, enemies.json
  sim/
    World.js            o "mundo" da partida (passo fixo de 1/60 s, eventos para som/efeitos)
    salas/              geração do andar, colisão, portas/ondas (RoomDirector), itens e interação
    personagens/        jogador, habilidades (skills.js) e passivos (passives.js)
    inimigos/           IA dos inimigos (behaviors.js) e chefes (chefes/xerox.js)
    armas/              disparo, corpo a corpo e projéteis
    combat.js           dano, críticos, efeitos (fogo/gelo/veneno/choque), explosões, drops
client/
  index.html, galeria.html
  src/
    scenes/             Boot, Menu, CharacterSelect, Game, Hud, Pause, Result
    render/             sprites provisórios gerados por código, tilemap, efeitos visuais
    ui/                 botões, card de arma, minimapa
    input/              teclado, mouse e controle
    audio/              efeitos e música chiptune
    net/                LocalSession (solo); a sessão online entra aqui na Etapa 2
  assets/sprites/       coloque aqui sua arte própria (veja LEIA-ME.md)
server/index.js         servidor Express (Socket.io entra na Etapa 2)
test/                   testes (node --test)
docs/ARMAS.md           como criar armas novas pelo JSON
```

## Personalizando

- **Armas novas:** edite `shared/data/weapons.json` — guia completo em [docs/ARMAS.md](docs/ARMAS.md).
- **Inimigos e andar:** `shared/data/enemies.json` (vida, velocidade, ataques, ondas por sala, raridade dos baús).
- **Personagens:** `shared/data/characters.json` (atributos, textos e o bloco `visual` que gera o sprite:
  pele, cabelo, estilo de cabelo, óculos, barba, cores do jaleco e da gola).
- **Arte própria:** `client/assets/sprites/LEIA-ME.md`.

## O que falta

### Etapa 2 — Multiplayer online
- Socket.io no `server/index.js`, rodando `World` no servidor (autoritativo) a 30–60 Hz.
- Salas com código: criar sala, entrar com código, 1 a 4 jogadores.
- Lobby: cada professor só pode ser escolhido uma vez; todos confirmam "pronto".
- Envio de inputs do cliente, snapshots do estado com interpolação e previsão do próprio jogador.
- Reconexão, saída de jogador no meio da partida, nomes acima dos personagens.
- Revive em equipe e câmera/HUD com a vida de todos os jogadores.

### Etapa 3 — Conteúdo completo
- Os 12 professores restantes jogáveis, com arma inicial, habilidade e passivo (Translate, Exército Histórico,
  Pique, Obra-Prima, Linha do Tempo, Campo Gravitacional, Grammar Shield, Reação em Cadeia, Clássicos Vivos,
  Circuito, Planta Carnívora, Terremoto/Vulcão) e aliados invocados.
- Andares 2 e 3, com temas próprios (sala da orientação e sala da coordenação) e inimigos novos (lousas, sinal do recreio).
- Chefe do Andar 2 **Katia** (2 fases: Assembleia, Conversa Particular, "Como você está se sentindo?", Divã).
- Chefe final **Samara** (3 fases: Advertência, Caderno Preto, Suspensão, fase final combinada).
- Loja (moedas), estátua de buff, mesa de laboratório (forja: combinar 2 armas), itens passivos.
- 40+ armas (hoje são 15), receitas de forja e mais efeitos.
- Co-op local (2 jogadores no mesmo teclado ou com controles) — a lógica já suporta vários jogadores.
- Balanceamento com testes de jogo de verdade (hoje foi calibrado com um bot), opções de volume, tela cheia.
- Arte final: os sprites atuais são provisórios (gerados por código) e podem ser trocados sem mexer no código.
