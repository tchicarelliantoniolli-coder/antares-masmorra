# Trocando os sprites provisórios por arte própria

Todos os sprites do jogo são gerados por código (formas e cores) para você poder começar a jogar já.
Para usar sua própria arte, coloque o PNG nesta pasta e registre a chave em `overrides.json`:

```json
{
  "sprites": {
    "char_harilson": { "file": "char_harilson.png", "frameWidth": 32, "frameHeight": 32 },
    "enemy_estojo":  { "file": "estojo.png", "frameWidth": 32, "frameHeight": 32 },
    "wpn_regua_espada": { "file": "regua.png" }
  }
}
```

Abra `http://localhost:3000/galeria.html` para ver todas as chaves e o formato de cada sprite.

| Chave | Tamanho | Quadros |
|---|---|---|
| `char_<id>` (professores e coordenação) | 32x32 por quadro | 6 em fila: parado 1, parado 2, andando 1–4 |
| `enemy_caderno_zumbi`, `enemy_prova_voadora`, `enemy_estojo` | 32x32 | 2 (animação) |
| `enemy_maquina_xerox` | 64x64 | 3 (normal, brilho, fase 2 brava) |
| `wpn_<id da arma>` | livre (aponta para a direita, cabo à esquerda) | 1 |
| `proj_<id da arma>` | livre (aponta para a direita) | 1 |
| `chest_closed`, `chest_open`, `heal_station`, `apple`, `coin`, `energy` | livre | 1 |
| `portal` | 48x48 | 8 |
| `tiles` | 256 x 224 (8 colunas x 7 temas de 32x32) | — |

Dica: desenhe em 32x32 com o personagem virado para a direita (o jogo espelha para a esquerda).
