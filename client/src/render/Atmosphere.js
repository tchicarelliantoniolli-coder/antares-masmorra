import { TILE, T } from '/shared/sim/constants.js';
import { LIGHT_DECOR, PARTICLE_KINDS } from '/shared/sim/salas/kinds.js';
import { GAME_W, GAME_H } from '../config.js';
import { makeCanvas, hexToRgb } from './pixel.js';

/**
 * Atmosfera da sala: luz ambiente com "poças de luz", feixes de sol, partículas por tema e vinheta.
 *
 * Tudo é derivado do que o cliente já tem (mapa, salas, áreas, jogadores e data.themes / floors[].ambient),
 * sem sorteios da simulação: funciona igual no solo, no co-op local e no online.
 *
 * Técnica da luz (leve): em vez de uma camada de tela inteira (que custa preenchimento em toda a tela, caro
 * em GPU fraca ou por software), a luz vira COR POR VÉRTICE nos tiles do chão: a cada quadro calculamos, nos
 * cantos dos tiles visíveis, quanto escuro (ambiente + vinheta) sobra depois das "poças de luz", e o próprio
 * desenho do tilemap multiplica essa cor (o GPU interpola entre os cantos, então o degradê é suave). Custo
 * extra de pixels: zero. Só o chão (tilemap) é escurecido; decoração, caixas, inimigos, avisos de ataque, balas
 * e jogador ficam sempre com o brilho normal. Feixes de sol, brilhos coloridos e partículas são sprites pequenos.
 *
 * Se data.themes (ou o ambient de um tema) faltar, a parte correspondente simplesmente não aparece.
 */

// ------------------------------------------------------------------ constantes visuais
const MAX_ALPHA = 0.35;          // escurecimento máximo (tema + andar combinados)
const VINHETA = 0.3;             // escurecimento extra nos cantos da tela (fração de preto)
const GANHO = 1.15;              // compensa o fato de a cor por vértice só "multiplicar" (não misturar) a cor ambiente
const REF_CHAO = 0.6;            // brilho médio do chão, usado para converter a cor ambiente em multiplicador
const DEPTH_BRILHO = 0.55;       // brilhos coloridos de lâmpadas e áreas (acima do piso, decalques e sombras)
const DEPTH_FEIXE = 0.56;        // feixes de sol (abaixo dos obstáculos, que o B1 desenha em 0.6)
const DEPTH_PART = 8500;         // partículas (abaixo das balas, que ficam em 9000)
const MAX_PARTICULAS = 40;       // orçamento de partículas vivas
const MAX_LUZES = 48;            // máximo de poças de luz por quadro
const MAX_BRILHOS_AREA = 14;     // brilhos coloridos de fogo/ácido/poças ao mesmo tempo

const HALO_JOGADOR = 140;        // raio (px) do halo ao redor do jogador
const HALO_CAIDO = 70;
const LAMPADA_RAIO = 118;       // raio da poça de luz (o brilho ADD é menor: LAMPADA_BRILHO)
const LAMPADA_BRILHO = 70;
const JANELA_RAIO = 64;

// feixe de sol (px): janela de 32 de largura, inclinado para o centro da sala
const FEIXE_TOPO = 30, FEIXE_BASE = 50, FEIXE_ALTURA = 116, FEIXE_INCLINA = 54;
const FEIXE_TEX_W = FEIXE_INCLINA + FEIXE_BASE + 2;

// cor do brilho e luz por tipo de área (a cor segue o mesmo desenho das áreas no WorldRenderer)
const AREA_LUZ = {
  fire_ground: { cor: 0xff8a2a, raio: 1.9, forca: 0.9, brilho: 0.30 },
  volcano: { cor: 0xff6a20, raio: 1.5, forca: 0.9, brilho: 0.30 },
  pool: null, // depende do estilo (fogo, ácido, gelo, tinta)
  singularity: { cor: 0x9a6aff, raio: 1.4, forca: 0.6, brilho: 0.18 },
  gravity: { cor: 0x9a6aff, raio: 1.4, forca: 0.6, brilho: 0.18 }
};
const POOL_LUZ = {
  fire: { cor: 0xff8a2a, brilho: 0.30 },
  acid: { cor: 0x8cff4a, brilho: 0.26 },
  ice: { cor: 0x8fe3ff, brilho: 0.24 },
  paint: { cor: 0xe04ad0, brilho: 0.18 }
};

const LAMPADA_COR = 0xffe2a8;
const LAMPADA_COR_LAB = 0xbfeaff;
const FEIXE_COR = 0xfff0c0;

// padrão de "piscada" da lâmpada de laboratório (passos de 0,05 s)
const PISCADA = [1, 0.25, 1, 0.5, 0.15, 1, 0.35, 1];

// ------------------------------------------------------------------ texturas pré-geradas
const smooth = (t) => t * t * (3 - 2 * t);
/** Marca um objeto como da atmosfera (não é "chão": não recebe a cor por vértice). */
const meu = (o) => { o._atm = true; return o; };

function texLuz() {
  const [cv, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    g.addColorStop(t, `rgba(255,255,255,${(1 - smooth(t)).toFixed(3)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return cv;
}

/** Feixe de sol já inclinado (paralelogramo que alarga e some com a distância), com sombra do caixilho da janela. */
function texFeixe() {
  const H = FEIXE_ALTURA;
  const [cv, ctx] = makeCanvas(FEIXE_TEX_W, H);
  const rows = ctx.createImageData(FEIXE_TEX_W, H);
  for (let y = 0; y < H; y++) {
    const u = y / H;
    const w = FEIXE_TOPO + (FEIXE_BASE - FEIXE_TOPO) * u;
    const left = u * FEIXE_INCLINA;
    const v = Math.pow(1 - u, 1.15);
    const bar = Math.abs(u - 0.36) < 0.035 ? 0.55 : 1; // barra horizontal do caixilho
    for (let x = 0; x < FEIXE_TEX_W; x++) {
      const k = (x - left) / w;
      if (k < 0 || k > 1) continue;
      const edge = smooth(Math.min(1, Math.min(k, 1 - k) / 0.22));
      const mullion = Math.abs(k - 0.5) < 0.035 ? 0.55 : 1; // barra vertical do caixilho
      const a = v * edge * mullion * bar;
      const i = (y * FEIXE_TEX_W + x) * 4;
      rows.data[i] = 255; rows.data[i + 1] = 255; rows.data[i + 2] = 255;
      rows.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(rows, 0, 0);
  return cv;
}

/** Pixel art pequena a partir de linhas de texto: W = branco, l = cinza claro, d = cinza (o tint dá a cor). */
function arte(linhas) {
  const h = linhas.length, w = linhas[0].length;
  const [cv, ctx] = makeCanvas(w, h);
  const tom = { W: 255, l: 205, d: 150 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = linhas[y][x];
      if (!tom[c]) continue;
      ctx.fillStyle = `rgb(${tom[c]},${tom[c]},${tom[c]})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

function texBolha() {
  const [cv, ctx] = makeCanvas(9, 9);
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x - 4, y - 4);
      let a = 0;
      if (d <= 4.2 && d > 3) a = 0.85;
      else if (d <= 3) a = 0.14;
      if (a) { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(x, y, 1, 1); }
    }
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(2, 2, 2, 1); ctx.fillRect(2, 3, 1, 1); // brilho
  return cv;
}

function texVapor() {
  const [cv, ctx] = makeCanvas(24, 24);
  const g = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 24, 24);
  return cv;
}

function texPoeira() {
  const [cv, ctx] = makeCanvas(3, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(1, 0, 1, 3); ctx.fillRect(0, 1, 3, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(1, 1, 1, 1);
  return cv;
}

function texBrasa() {
  const [cv, ctx] = makeCanvas(3, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(1, 0, 1, 3); ctx.fillRect(0, 1, 3, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(1, 1, 1, 1);
  return cv;
}

const FOLHA = ['.WWW...', 'WWWWW..', 'WdWWWW.', '.WWWWWW', '...ddW.'];
const PAPEL = ['WWWWWWW', 'WlllllW', 'WWWWWWW', 'WlllllW', 'WWWWWWW', 'WlllllW', 'WWWWWWW', 'WllllWW', 'WWWWWWW'];

function garantirTexturas(scene) {
  const tm = scene.textures;
  const add = (key, cv, linear = false) => {
    if (tm.exists(key)) return;
    const tex = tm.addCanvas(key, cv);
    if (linear) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
  };
  add('atm_luz', texLuz(), true);
  add('atm_feixe', texFeixe(), true);
  add('atm_p_poeira', texPoeira());
  add('atm_p_bolha', texBolha());
  add('atm_p_folha', arte(FOLHA));
  add('atm_p_vapor', texVapor(), true);
  add('atm_p_papel', arte(PAPEL));
  add('atm_p_brasa', texBrasa());
}

// ------------------------------------------------------------------ utilidades
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Lê { color, alpha } do JSON com segurança; devolve null se não houver nada utilizável. */
function lerAmbiente(o) {
  if (!o || typeof o !== 'object') return null;
  const a = Number(o.alpha);
  if (!Number.isFinite(a) || a <= 0) return null;
  let rgb = [0, 0, 0];
  if (typeof o.color === 'string' && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(o.color)) rgb = hexToRgb(o.color);
  const mul = Number(o.themeMul);
  return { rgb, a: clamp(a, 0, 1), mul: Number.isFinite(mul) ? clamp(mul, 0, 2) : 1 };
}

/**
 * Combina o ambiente do tema (por baixo) com o do andar (por cima, como duas camadas translúcidas).
 * O alpha total nunca passa de MAX_ALPHA. 'themeMul' (opcional, no andar) escala o alpha do tema.
 */
function combinarAmbiente(tema, andar) {
  const t = lerAmbiente(tema), f = lerAmbiente(andar);
  if (!t && !f) return null;
  const a1 = t ? t.a * (f ? f.mul : 1) : 0;
  const a2 = f ? f.a : 0;
  const a = a1 + a2 * (1 - a1);
  if (a <= 0) return null;
  const rgb = [0, 1, 2].map((k) => ((t ? t.rgb[k] : 0) * a1 * (1 - a2) + (f ? f.rgb[k] : 0) * a2) / a);
  return { rgb, a: Math.min(a, MAX_ALPHA) };
}

// Parâmetros de cada partícula: n = quantas ao mesmo tempo, gap = intervalo entre nascimentos (s),
// vida = [min, max] em segundos, alpha = opacidade máxima.
const PART = {
  poeira: { tex: 'atm_p_poeira', n: 26, gap: 0.12, vida: [6, 11], alpha: 0.35, add: false },
  bolhas: { tex: 'atm_p_bolha', n: 16, gap: 0.25, vida: [2.2, 4.2], alpha: 0.8, add: false },
  folhas: { tex: 'atm_p_folha', n: 12, gap: 0.5, vida: [7, 11], alpha: 0.9, add: false },
  vapor: { tex: 'atm_p_vapor', n: 14, gap: 0.2, vida: [1.8, 2.8], alpha: 0.65, add: false },
  papeis: { tex: 'atm_p_papel', n: 2, gap: 1, vida: [5, 9], alpha: 0.85, add: false },
  brasas: { tex: 'atm_p_brasa', n: 24, gap: 0.15, vida: [2, 4.2], alpha: 0.95, add: true }
};

// ------------------------------------------------------------------ classe
export class Atmosphere {
  constructor(scene, world, data, wr = null) {
    this.scene = scene;
    this.wr = wr;                     // WorldRenderer (para achar o tilemap do chão)
    this.world = world;
    this.data = data;
    this.temas = data?.themes && typeof data.themes === 'object' ? data.themes : null;
    this.cam = scene.cameras.main;
    this.map = null;
    this.t = 0;                       // tempo em segundos (relógio do Phaser)
    this.beams = [];
    this.fixas = [];                  // luzes fixas do andar (lâmpadas e janelas)
    this.brilhosFixos = [];
    this.brilhosArea = [];
    this.parts = [];
    this.view = { x0: 0, y0: 0, x1: GAME_W, y1: GAME_H, z: 1 };
    this.roomId = null;               // sala sob a câmera (com histerese)
    this.roomCand = null;
    this.roomCandT = 0;
    this.particleKind = null;
    this.spawnAcc = 0;
    this.nextPapel = 2;
    this.amb = { r: 0, g: 0, b: 0, a: 0 }; // ambiente atual (suavizado)
    this.nLuzes = 0;                  // poças de luz deste quadro (x, y, raio x, raio y, força, cos, sen)
    this.luz = new Float32Array(MAX_LUZES * 7);
    this.grid = null;                 // cor por vértice do chão (um Uint32 por canto de tile)
    this.gridW = 0;
    this.layer = null;                // tilemap do piso em que a cor por vértice foi instalada
    this.chao = [];                   // objetos de chão com a cor por vértice instalada
    this.destroyed = false;
    this.enabled = true;

    garantirTexturas(scene);

    for (let i = 0; i < MAX_BRILHOS_AREA; i++) {
      this.brilhosArea.push(meu(scene.add.image(0, 0, 'atm_luz').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_BRILHO).setVisible(false)));
    }
    for (let i = 0; i < MAX_PARTICULAS; i++) {
      this.parts.push({ img: scene.add.image(0, 0, 'atm_p_poeira').setDepth(DEPTH_PART).setVisible(false), on: false });
    }

    // só WebGL: no canvas o chão não recebe luz (os feixes, brilhos e partículas continuam)
    this.webgl = scene.sys.game.renderer?.type === Phaser.WEBGL;
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.iluminar, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.rebuild();
  }

  /** Liga/desliga tudo (usado para medir o custo e como "kill switch" de depuração). */
  setEnabled(on) {
    this.enabled = !!on;
    for (const g of this.brilhosFixos) g.setVisible(this.enabled);
    if (this.enabled) return;
    this.desinstalarChao();
    for (const b of this.beams) b.img.setVisible(false);
    for (const g of this.brilhosArea) g.setVisible(false);
    for (const p of this.parts) { p.on = false; p.img.setVisible(false); }
  }

  // ---------------------------------------------------------------- andar novo
  /** Lê o mapa atual: feixes, lâmpadas e luzes fixas. Chamado no início e a cada troca de andar. */
  rebuild() {
    const w = this.world;
    this.limparFixos();
    this.desinstalarChao();
    this.map = w.map;
    this.decorN = w.map?.decor?.length;
    for (const p of this.parts) { p.on = false; p.img.setVisible(false); }
    this.roomId = null; this.roomCand = null;
    this.particleKind = null;
    if (!w.map) return;
    const scene = this.scene;
    const decor = Array.isArray(w.map.decor) ? w.map.decor : [];
    for (const d of decor) {
      if (!d || !LIGHT_DECOR.includes(d.kind)) continue;
      const wTiles = d.w || 1;
      const room = this.salaDoTile(d.tx, d.ty);
      const cx = (d.tx + wTiles / 2) * TILE;
      const lab = room?.theme === 'laboratorio';
      if (d.kind === 'lampada') {
        const luz = { x: cx, y: (d.ty + 1) * TILE + 26, r: LAMPADA_RAIO, forca: 0.95, flick: lab ? { next: -1, ate: 0 } : null, k: 1 };
        luz.glow = meu(scene.add.image(luz.x, luz.y, 'atm_luz').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_BRILHO)
          .setTint(lab ? LAMPADA_COR_LAB : LAMPADA_COR).setScale((LAMPADA_BRILHO * 2) / 128).setAlpha(0.2));
        luz.glowAlpha = 0.2;
        this.fixas.push(luz);
        this.brilhosFixos.push(luz.glow);
      } else if (d.kind === 'janela') {
        // luz na própria janela + feixe de sol inclinado para o centro da sala
        this.fixas.push({ x: cx, y: (d.ty + 1) * TILE + 6, r: JANELA_RAIO, forca: 0.55, k: 1 });
        const dir = room && cx < (room.x0 + room.w / 2) * TILE ? 1 : -1;
        // o topo do feixe fica centrado na janela; espelhado (flipX), o topo vai para a ponta direita da imagem
        const left = dir > 0 ? cx - FEIXE_TOPO / 2 : cx + FEIXE_TOPO / 2 - FEIXE_TEX_W;
        const img = meu(scene.add.image(left, (d.ty + 1) * TILE, 'atm_feixe').setOrigin(0, 0).setFlipX(dir < 0)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_FEIXE).setTint(FEIXE_COR).setAlpha(0.2));
        const b = { img, cx, y0: (d.ty + 1) * TILE, dir, ph: rnd(0, 6.28), room: room ? room.id : -1 };
        this.beams.push(b);
        // mancha de luz ao longo do feixe (elipse inclinada)
        const u = 0.52;
        const off = dir * u * (FEIXE_INCLINA + (FEIXE_BASE - FEIXE_TOPO) / 2);
        const ang = Math.atan2(FEIXE_INCLINA + (FEIXE_BASE - FEIXE_TOPO) / 2, FEIXE_ALTURA);
        this.fixas.push({ x: cx + off, y: b.y0 + u * FEIXE_ALTURA, r: 56, forca: 0.8, sx: 0.62, sy: 1.5, rot: -dir * ang, k: 1 });
      }
    }
  }

  limparFixos() {
    for (const b of this.beams) b.img.destroy();
    for (const g of this.brilhosFixos) g.destroy();
    this.beams = [];
    this.fixas = [];
    this.brilhosFixos = [];
  }

  salaDoTile(tx, ty) {
    const m = this.map;
    if (!m || !m.inBounds?.(tx, ty)) return null;
    const id = m.owner[m.idx(tx, ty)];
    return id >= 0 ? this.world.rooms[id] || null : null;
  }

  // ---------------------------------------------------------------- por quadro (lógica)
  sync(dt, time) {
    if (this.destroyed || !this.enabled) return;
    const w = this.world;
    if (w.map !== this.map || w.map?.decor?.length !== this.decorN) this.rebuild();
    if (!this.map) return;
    this.t = time / 1000;
    dt = Math.min(dt, 0.1);
    this.atualizarCamera();
    this.atualizarSala(dt);
    this.atualizarAmbiente(dt);
    this.atualizarFeixes();
    this.atualizarParticulas(dt);
  }

  atualizarCamera() {
    const c = this.cam, z = c.zoom || 1;
    const mx = c.width / 2, my = c.height / 2;
    const v = this.view;
    v.z = z;
    v.x0 = c.scrollX + mx * (1 - 1 / z);
    v.y0 = c.scrollY + my * (1 - 1 / z);
    v.x1 = v.x0 + c.width / z;
    v.y1 = v.y0 + c.height / z;
  }

  /** Sala sob o centro da câmera (com meio segundo de histerese para não piscar nas portas). */
  atualizarSala(dt) {
    const v = this.view;
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    const m = this.map;
    const tx = Math.floor(cx / TILE), ty = Math.floor(cy / TILE);
    let id = m.inBounds(tx, ty) ? m.owner[m.idx(tx, ty)] : -1;
    if (id === undefined) id = -1;
    if (this.roomId === null) { this.roomId = id; this.roomCand = id; this.roomCandT = 0; return; }
    if (id === this.roomId) { this.roomCand = id; this.roomCandT = 0; return; }
    if (id !== this.roomCand) { this.roomCand = id; this.roomCandT = 0; return; }
    this.roomCandT += dt;
    if (this.roomCandT >= 0.4) { this.roomId = id; this.roomCandT = 0; }
  }

  temaAtual() {
    const room = this.roomId >= 0 ? this.world.rooms[this.roomId] : null;
    return room ? room.theme : 'corredor';
  }

  atualizarAmbiente(dt) {
    const tema = this.temas ? this.temas[this.temaAtual()] : null;
    const andar = this.world.floorDef?.ambient;
    const alvo = this.temas ? combinarAmbiente(tema?.ambient, andar) : null;
    const a = this.amb;
    const k = 1 - Math.exp(-dt * 2.5);
    if (alvo) {
      if (a.a < 0.001) { a.r = alvo.rgb[0]; a.g = alvo.rgb[1]; a.b = alvo.rgb[2]; }
      a.r += (alvo.rgb[0] - a.r) * k; a.g += (alvo.rgb[1] - a.g) * k; a.b += (alvo.rgb[2] - a.b) * k;
      a.a += (alvo.a - a.a) * k;
    } else a.a += (0 - a.a) * k;
  }

  atualizarFeixes() {
    const v = this.view;
    for (const b of this.beams) {
      const visivel = b.cx > v.x0 - 160 && b.cx < v.x1 + 160 && b.y0 > v.y0 - 160 && b.y0 < v.y1 + 40;
      b.img.setVisible(visivel);
      if (!visivel) continue;
      b.img.setAlpha(0.17 + 0.05 * Math.sin(this.t * 0.55 + b.ph) + 0.02 * Math.sin(this.t * 1.7 + b.ph * 2));
    }
  }

  // ---------------------------------------------------------------- luz (depois que a câmera se moveu)
  /** Junta as poças de luz do quadro e recalcula a cor por vértice do chão. Roda em POST_UPDATE (câmera já movida). */
  iluminar() {
    if (this.destroyed || !this.enabled || !this.map) return;
    this.atualizarCamera();
    this.piscarLampadas();
    this.atualizarBrilhos();
    if (!this.webgl || !this.temas) return; // sem data.themes: o chão fica como está
    const layer = this.wr?.layer;
    if (!layer || !layer.layer) return;
    if (layer !== this.layer) this.instalarChao(); // tilemap novo (andar novo)

    const v = this.view, w = this.world;
    // poças de luz: jogadores, lâmpadas/janelas, fogo/ácido/poças e portais
    this.nLuzes = 0;
    for (const p of w.players) {
      if (p.dead) continue;
      this.poca(p.x, p.y - 6, p.downed ? HALO_CAIDO : HALO_JOGADOR, p.downed ? 0.6 : 1);
    }
    for (const f of this.fixas) this.poca(f.x, f.y, f.r, f.forca * f.k, f.sx, f.sy, f.rot);
    for (const ar of w.areas) {
      const cfg = this.configArea(ar);
      if (cfg) this.poca(ar.x, ar.y, ar.r * cfg.raio, cfg.forca * this.fadeArea(ar));
    }
    for (const pk of w.pickups) if (pk.kind === 'portal') this.poca(pk.x, pk.y, 90, 0.85);

    // ambiente (já suavizado) -> multiplicador por canal; vinheta em preto
    const a = this.amb.a * GANHO;
    const kr = clamp(1 - this.amb.r / 255 / REF_CHAO, 0, 1), kg = clamp(1 - this.amb.g / 255 / REF_CHAO, 0, 1), kb = clamp(1 - this.amb.b / 255 / REF_CHAO, 0, 1);
    const m = this.map, gw = this.gridW, grid = this.grid;
    const i0 = Math.max(0, Math.floor(v.x0 / TILE) - 2), i1 = Math.min(m.w, Math.floor(v.x1 / TILE) + 3);
    const j0 = Math.max(0, Math.floor(v.y0 / TILE) - 2), j1 = Math.min(m.h, Math.floor(v.y1 / TILE) + 3);
    const cam = this.cam, z = v.z, mx = cam.width / 2, my = cam.height / 2;
    const L = this.luz, n = this.nLuzes;
    for (let j = j0; j <= j1; j++) {
      const wy = j * TILE;
      const sy = (my + z * (wy - cam.scrollY - my) - my) / my;
      for (let i = i0; i <= i1; i++) {
        const wx = i * TILE;
        // quanto desta posição está iluminado (as poças se somam como camadas translúcidas)
        let lit = 0;
        for (let k = 0; k < n; k++) {
          const o = k * 7;
          const dx = wx - L[o], dy = wy - L[o + 1];
          const u = (dx * L[o + 5] + dy * L[o + 6]) * L[o + 2];     // L[o+2] = 1 / raio x
          const t = (dy * L[o + 5] - dx * L[o + 6]) * L[o + 3];     // L[o+3] = 1 / raio y
          const q = u * u + t * t;
          if (q >= 1) continue;
          const e = 1 - q;
          lit = 1 - (1 - lit) * (1 - e * e * (3 - 2 * e) * L[o + 4]);
        }
        const d = a * (1 - lit);
        const sx = (mx + z * (wx - cam.scrollX - mx) - mx) / mx;
        const vr = sx * sx * 0.8 + sy * sy * 1.05;
        const vg = vr > 0.3 ? smooth(Math.min(1, (Math.sqrt(vr) - 0.55) / 0.85)) * VINHETA : 0;
        const f = 1 - vg;
        const r = clamp((1 - d * kr) * f, 0, 1), g = clamp((1 - d * kg) * f, 0, 1), b = clamp((1 - d * kb) * f, 0, 1);
        grid[j * gw + i] = ((r * 255) << 16 | (g * 255) << 8 | (b * 255)) >>> 0;
      }
    }
  }

  /** Registra uma poça de luz (em px do mundo); ignora as que estão fora da câmera. */
  poca(x, y, raio, forca, sx = 1, sy = 1, rot = 0) {
    if (this.nLuzes >= MAX_LUZES || forca <= 0.01) return;
    const v = this.view, rx = raio * sx, ry = raio * sy, m = Math.max(rx, ry);
    if (x < v.x0 - m - TILE || x > v.x1 + m + TILE || y < v.y0 - m - TILE || y > v.y1 + m + TILE) return;
    const o = this.nLuzes++ * 7;
    const L = this.luz;
    L[o] = x; L[o + 1] = y; L[o + 2] = 1 / rx; L[o + 3] = 1 / ry; L[o + 4] = forca; L[o + 5] = Math.cos(rot); L[o + 6] = Math.sin(rot);
  }

  /**
   * Acha tudo que é "chão" (tilemaps e imagens estáticas alinhadas à grade, com depth em [0, 1): piso, decalques,
   * sombras, obstáculos) e troca o desenho deles por uma cópia que usa a cor por vértice (this.grid) em vez de
   * uma cor por tile. É o mesmo desenho do Phaser, só que com 4 cores por quadradinho de 32 px.
   * Decoração de parede, caixas, espinhos, textos, inimigos e jogadores (depth >= 1) ficam como estão.
   */
  instalarChao() {
    this.desinstalarChao();
    const m = this.map;
    this.gridW = m.w + 1;
    this.grid = new Uint32Array(this.gridW * (m.h + 1)).fill(0xffffff);
    this.layer = this.wr.layer;
    const getTint = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
    const self = this;
    const tinta = (c, a) => getTint(c ?? 0xffffff, a);

    // tilemap: um quadrilátero por tile, com a cor dos 4 cantos (topo-esq, topo-dir, base-esq, base-dir)
    const renderTiles = function renderTilemapComLuz(renderer, src, camera) {
      const tiles = src.cull(camera);
      const count = tiles.length;
      const alpha = camera.alpha * src.alpha;
      if (count === 0 || alpha <= 0) return;
      const gidMap = src.gidMap;
      const pipeline = renderer.pipelines.set(src.pipeline, src);
      const grid = self.grid, gw = self.gridW;
      renderer.pipelines.preBatch(src);
      for (let i = 0; i < count; i++) {
        const tile = tiles[i];
        const tileset = gidMap[tile.index];
        if (!tileset) continue;
        const coords = tileset.getTileTextureCoordinates(tile.index);
        const tw = tileset.tileWidth, th = tileset.tileHeight;
        if (!coords || tw === 0 || th === 0) continue;
        const texture = tileset.glTexture;
        const unit = pipeline.setTexture2D(texture, src);
        const a = alpha * tile.alpha;
        const k = tile.y * gw + tile.x;
        pipeline.batchTexture(
          src, texture, texture.width, texture.height,
          src.x + tile.pixelX * src.scaleX + (tw * 0.5 * src.scaleX - tileset.tileOffset.x),
          src.y + tile.pixelY * src.scaleY + (th * 0.5 * src.scaleY - tileset.tileOffset.y),
          tw, th, src.scaleX, src.scaleY, tile.rotation, tile.flipX, tile.flipY,
          src.scrollFactorX, src.scrollFactorY, tw * 0.5, th * 0.5,
          coords.x, coords.y, tw, th,
          tinta(grid[k], a), tinta(grid[k + 1], a), tinta(grid[k + gw], a), tinta(grid[k + gw + 1], a),
          tile.tintFill, 0, 0, camera, null, true, unit, true
        );
      }
      renderer.pipelines.postBatch(src);
    };

    // imagem estática alinhada à grade (ex.: decalques da sala): fatia em quadradinhos de 32 px visíveis
    const renderImagem = function renderImagemComLuz(renderer, src, camera, parentMatrix) {
      const frame = src.frame;
      if (src.scaleX !== 1 || src.scaleY !== 1 || src.rotation !== 0 || src.flipX || src.flipY || src.originX !== 0 || src.originY !== 0
        || src.x % TILE || src.y % TILE || src.isCropped || parentMatrix || !frame.glTexture) {
        return Phaser.GameObjects.Image.prototype.renderWebGL.call(src, renderer, src, camera, parentMatrix); // desenho normal
      }
      const alpha = camera.alpha * src.alpha;
      if (alpha <= 0) return;
      const wv = camera.worldView, fw = frame.cutWidth, fh = frame.cutHeight;
      const c0 = Math.max(0, Math.floor((wv.x - src.x) / TILE)), c1 = Math.min(Math.ceil(fw / TILE), Math.ceil((wv.right - src.x) / TILE));
      const r0 = Math.max(0, Math.floor((wv.y - src.y) / TILE)), r1 = Math.min(Math.ceil(fh / TILE), Math.ceil((wv.bottom - src.y) / TILE));
      if (c1 <= c0 || r1 <= r0) return;
      const pipeline = renderer.pipelines.set(src.pipeline, src);
      const texture = frame.glTexture, grid = self.grid, gw = self.gridW;
      const gx0 = src.x / TILE, gy0 = src.y / TILE;
      renderer.pipelines.preBatch(src);
      const unit = pipeline.setTexture2D(texture, src);
      for (let r = r0; r < r1; r++) {
        for (let c = c0; c < c1; c++) {
          const cw = Math.min(TILE, fw - c * TILE), ch = Math.min(TILE, fh - r * TILE);
          const k = (gy0 + r) * gw + gx0 + c;
          pipeline.batchTexture(
            src, texture, texture.width, texture.height,
            src.x + c * TILE + cw * 0.5, src.y + r * TILE + ch * 0.5, cw, ch, 1, 1, 0, false, false,
            src.scrollFactorX, src.scrollFactorY, cw * 0.5, ch * 0.5,
            frame.cutX + c * TILE, frame.cutY + r * TILE, cw, ch,
            tinta(grid[k], alpha), tinta(grid[k + 1], alpha), tinta(grid[k + gw], alpha), tinta(grid[k + gw + 1], alpha),
            0, 0, 0, camera, null, true, unit, true
          );
        }
      }
      renderer.pipelines.postBatch(src);
    };

    this.chao = [];
    for (const o of this.scene.children.list) {
      if (o._atm || !(o.depth >= 0 && o.depth < 1)) continue;
      if (o.type === 'TilemapLayer') o.renderWebGL = renderTiles;
      else if (o.type === 'Image') o.renderWebGL = renderImagem;
      else continue;
      this.chao.push(o);
    }
  }

  /** Devolve a cada objeto de chão o desenho original do Phaser. */
  desinstalarChao() {
    for (const o of this.chao) delete o.renderWebGL;
    this.chao = [];
    this.layer = null;
  }

  /** A lâmpada de laboratório pisca de vez em quando (a luz e o brilho, não a arte). */
  piscarLampadas() {
    const t = this.t;
    for (const f of this.fixas) {
      const fl = f.flick;
      if (!fl) continue;
      if (fl.next < 0) fl.next = t + rnd(3, 9); // primeira piscada: de 3 a 9 s depois de aparecer
      if (fl.ate > 0) {
        const passo = Math.floor((t - fl.ini) / 0.05);
        if (passo >= PISCADA.length) { fl.ate = 0; fl.next = t + rnd(5, 13); f.k = 1; }
        else f.k = PISCADA[passo];
      } else if (t >= fl.next) { fl.ini = t; fl.ate = 1; }
      if (f.glow) f.glow.setAlpha(f.glowAlpha * f.k);
    }
  }

  // ---------------------------------------------------------------- brilhos coloridos das áreas
  configArea(ar) {
    if (ar.kind === 'pool') {
      const s = POOL_LUZ[ar.style] || POOL_LUZ.paint;
      return { cor: s.cor, raio: 1.8, forca: 0.8, brilho: s.brilho };
    }
    return AREA_LUZ[ar.kind] || null;
  }

  fadeArea(ar) {
    const rest = ar.life - ar.t;
    return rest < 0.6 ? clamp(rest / 0.6, 0, 1) : 1;
  }

  atualizarBrilhos() {
    const v = this.view;
    let n = 0;
    for (const ar of this.world.areas) {
      const cfg = this.configArea(ar);
      if (!cfg || n >= this.brilhosArea.length) continue;
      const rr = ar.r * cfg.raio;
      if (ar.x < v.x0 - rr || ar.x > v.x1 + rr || ar.y < v.y0 - rr || ar.y > v.y1 + rr) continue;
      const pulso = 0.85 + 0.15 * Math.sin(this.t * 9 + (ar.id || 0));
      this.brilhosArea[n++].setVisible(true).setPosition(ar.x, ar.y).setTint(cfg.cor)
        .setScale((rr * 2) / 128).setAlpha(cfg.brilho * this.fadeArea(ar) * pulso);
    }
    for (; n < this.brilhosArea.length; n++) this.brilhosArea[n].setVisible(false);
  }

  // ---------------------------------------------------------------- partículas
  /** Região de spawn: interior da sala atual ∩ área visível da câmera (em px). */
  regiaoSpawn() {
    const room = this.roomId >= 0 ? this.world.rooms[this.roomId] : null;
    if (!room) return null;
    const v = this.view;
    const x0 = Math.max((room.x0 + 1) * TILE, v.x0 - 8), x1 = Math.min((room.x0 + room.w - 1) * TILE, v.x1 + 8);
    const y0 = Math.max((room.y0 + 1) * TILE, v.y0 - 8), y1 = Math.min((room.y0 + room.h - 1) * TILE, v.y1 + 8);
    if (x1 - x0 < 24 || y1 - y0 < 24) return null;
    return { x0, y0, x1, y1, room };
  }

  /** Ponto aleatório de chão livre dentro da região (algumas tentativas; null se não achar). */
  pontoLivre(reg) {
    for (let i = 0; i < 5; i++) {
      const x = rnd(reg.x0, reg.x1), y = rnd(reg.y0, reg.y1);
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (this.map.get(tx, ty) === T.FLOOR && this.map.owner[this.map.idx(tx, ty)] === reg.room.id) return [x, y];
    }
    return null;
  }

  atualizarParticulas(dt) {
    const room = this.roomId >= 0 ? this.world.rooms[this.roomId] : null;
    const tema = room && this.temas ? this.temas[room.theme] : null;
    // sala de chefe fica sem partículas: papéis e brasas se confundem com as balas do Xerox e da Samara
    const kind = tema && room.type !== 'boss' && PARTICLE_KINDS.includes(tema.particles) ? tema.particles : null;

    // sala trocou: as partículas antigas somem rápido
    if (kind !== this.particleKind) {
      this.particleKind = kind;
      this.encher = true;                 // ao entrar numa sala já aparece metade das partículas
      this.spawnAcc = 0;
      this.nextPapel = this.t + rnd(1.5, 4);
      for (const p of this.parts) if (p.on && p.kind !== kind && p.life - p.t > 0.5) p.life = p.t + 0.5;
    }

    // anda e desenha as vivas
    let vivas = 0;
    for (const p of this.parts) {
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life) { p.on = false; p.img.setVisible(false); continue; }
      vivas++;
      this.moverParticula(p, dt);
    }

    if (!kind) return;
    const reg = this.regiaoSpawn();
    if (!reg) return;
    const cfg = PART[kind];
    if (this.encher) {
      this.encher = false;
      if (kind !== 'papeis') {
        const n = Math.ceil(Math.min(cfg.n, MAX_PARTICULAS) * 0.55);
        for (let i = 0; i < n && vivas < MAX_PARTICULAS; i++) {
          if (!this.nascer(kind, reg)) break;
          const q = this.parts.find((x) => x.on && x.t === 0);
          if (q) q.t = rnd(0, q.life * 0.6); // idades variadas: não nascem todas juntas
          vivas++;
        }
      }
    }
    // reposição gradual (uma por vez, em intervalo curto) até o limite do tema
    this.spawnAcc += dt;
    const alvo = Math.min(cfg.n, MAX_PARTICULAS);
    let doTema = 0;
    for (const p of this.parts) if (p.on && p.kind === kind) doTema++;
    if (kind === 'papeis') {
      if (this.t >= this.nextPapel && doTema < cfg.n) { this.nascer(kind, reg); this.nextPapel = this.t + rnd(3.5, 8); }
      return;
    }
    while (this.spawnAcc >= cfg.gap && doTema < alvo && vivas < MAX_PARTICULAS) {
      this.spawnAcc -= cfg.gap;
      if (this.nascer(kind, reg)) { doTema++; vivas++; }
      else break;
    }
    if (this.spawnAcc > cfg.gap) this.spawnAcc = cfg.gap;
  }

  /** Acha uma partícula livre e a inicia; devolve false se não houver espaço ou lugar. */
  nascer(kind, reg) {
    const p = this.parts.find((q) => !q.on);
    if (!p) return false;
    const cfg = PART[kind];
    const img = p.img;
    p.kind = kind; p.t = 0; p.life = rnd(cfg.vida[0], cfg.vida[1]);
    p.ph = rnd(0, 6.28); p.vx = 0; p.vy = 0; p.rot = 0; p.vr = 0; p.esc = 1; p.alvo = cfg.alpha; p.beam = false;
    img.setTexture(cfg.tex).setBlendMode(cfg.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setRotation(0).setFlipX(false).setScale(1).clearTint();
    let pos = null;
    switch (kind) {
      case 'poeira': {
        // parte da poeira nasce dentro dos feixes de sol da sala (mais densa na luz)
        const bs = this.beams.filter((b) => b.room === reg.room.id && b.img.visible);
        if (bs.length && Math.random() < 0.4) {
          const b = pick(bs), u = Math.random();
          const w = FEIXE_TOPO + (FEIXE_BASE - FEIXE_TOPO) * u;
          pos = [b.cx + b.dir * u * (FEIXE_INCLINA + (FEIXE_BASE - FEIXE_TOPO) / 2) + rnd(-0.38, 0.38) * w, b.y0 + u * FEIXE_ALTURA * 0.95];
          p.beam = true; p.alvo = 0.75; p.esc = 1.15; p.vy = rnd(2, 7); p.vx = rnd(-3, 3);
        } else {
          pos = this.pontoLivre(reg);
          p.vx = rnd(-5, 5); p.vy = rnd(-4, 3); p.alvo = rnd(0.22, 0.45);
        }
        break;
      }
      case 'bolhas':
        pos = this.pontoLivre(reg);
        p.vy = -rnd(16, 28); p.vx = rnd(-2, 2); p.esc = rnd(0.7, 1.15); p.life = rnd(2.2, 4.2);
        img.setTint(pick([0x7fe8c8, 0x7fd0ff, 0xa8ffb8, 0x9ae0ff]));
        break;
      case 'folhas':
        pos = this.pontoLivre(reg);
        p.vx = rnd(10, 22); p.vy = rnd(16, 28); p.vr = rnd(-2.5, 2.5); p.rot = rnd(0, 6.28); p.esc = rnd(1.1, 1.4);
        img.setTint(pick([0x5fa83a, 0x86b83a, 0xd8b03a, 0xc8782a, 0x4a8f3a]));
        break;
      case 'vapor': {
        // sobe do balcão: ao redor da cantineira (ou do alto da sala, se ela não estiver lá)
        const npc = this.world.pickups.find((q) => q.kind === 'npc');
        if (npc && npc.x > reg.room.x0 * TILE && npc.x < (reg.room.x0 + reg.room.w) * TILE && npc.y > reg.room.y0 * TILE && npc.y < (reg.room.y0 + reg.room.h) * TILE) {
          pos = [npc.x + rnd(-110, 110), npc.y + rnd(10, 26)];
        } else pos = this.pontoLivre(reg);
        p.vy = -rnd(16, 26); p.vx = rnd(-3, 3); p.esc = rnd(0.6, 0.95);
        break;
      }
      case 'papeis': {
        const da = Math.random() < 0.5;
        pos = [da ? reg.x0 : reg.x1, rnd(reg.y0 + 20, reg.y1 - 20)];
        p.vx = (da ? 1 : -1) * rnd(70, 110); p.vy = rnd(-14, 14); p.life = Math.max(3, Math.abs(reg.x1 - reg.x0) / Math.abs(p.vx));
        p.vr = rnd(2, 4); p.rot = rnd(0, 6.28);
        break;
      }
      case 'brasas':
        pos = this.pontoLivre(reg);
        p.vy = -rnd(14, 30); p.vx = rnd(-4, 4); p.esc = rnd(1, 1.6); p.life = rnd(2, 4.2);
        img.setTint(pick([0xff7a2a, 0xffb040, 0xff4a20]));
        break;
      default: break;
    }
    if (!pos) return false;
    p.x = pos[0]; p.y = pos[1]; p.on = true;
    img.setPosition(p.x, p.y).setAlpha(0).setVisible(true);
    return true;
  }

  moverParticula(p, dt) {
    const img = p.img, t = p.t, f = t / p.life;
    let fade = Math.min(1, f / 0.18, (1 - f) / 0.25);
    let esc = p.esc, ang = 0;
    switch (p.kind) {
      case 'poeira':
        p.x += (p.vx + Math.sin(t * 0.9 + p.ph) * 4) * dt;
        p.y += (p.vy + Math.cos(t * 0.7 + p.ph) * 3) * dt;
        break;
      case 'bolhas': {
        p.x += (p.vx + Math.sin(t * 3 + p.ph) * 9) * dt;
        p.y += p.vy * dt;
        const resta = p.life - t;
        fade = Math.min(1, t / 0.25);
        if (resta < 0.16) { const k = 1 - resta / 0.16; esc *= 1 + 0.9 * k; fade *= 1 - k; } // estoura
        break;
      }
      case 'folhas':
        p.x += (p.vx + Math.sin(t * 2.2 + p.ph) * 14) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ang = p.rot + Math.sin(t * 2.2 + p.ph) * 0.6;
        break;
      case 'vapor':
        p.x += (p.vx + Math.sin(t * 1.6 + p.ph) * 7) * dt;
        p.y += p.vy * dt;
        esc *= 1 + f * 1.1;
        break;
      case 'papeis':
        p.x += p.vx * dt;
        p.y += (p.vy + Math.sin(t * 2.4 + p.ph) * 26) * dt;
        p.rot += p.vr * dt;
        ang = Math.sin(t * 1.7 + p.ph) * 0.8;
        esc = 1;
        img.setScale(Math.max(0.25, Math.abs(Math.cos(p.rot))) * 1.3, 1.3);
        break;
      case 'brasas':
        p.x += (p.vx + Math.sin(t * 4 + p.ph) * 8) * dt;
        p.y += p.vy * dt;
        fade *= 0.65 + 0.35 * Math.sin(t * 17 + p.ph * 3);
        break;
      default: break;
    }
    img.setPosition(p.x, p.y).setAlpha(Math.max(0, fade) * p.alvo);
    if (p.kind !== 'papeis') img.setScale(esc);
    if (ang) img.setRotation(ang);
  }

  // ---------------------------------------------------------------- limpeza
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.iluminar, this);
    this.desinstalarChao();
    this.limparFixos();
    for (const p of this.parts) p.img.destroy();
    for (const g of this.brilhosArea) g.destroy();
    this.parts = []; this.brilhosArea = []; this.grid = null;
  }
}
