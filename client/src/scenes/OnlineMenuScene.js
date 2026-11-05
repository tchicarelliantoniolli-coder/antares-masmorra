import { GAME_W, GAME_H, titleStyle, textStyle } from '../config.js';
import { OnlineClient } from '../net/OnlineClient.js';
import { sound } from '../audio/Sound.js';

/**
 * Menu do modo online: digitar o nome, criar uma sala (recebe um código de 4 letras)
 * ou entrar numa sala com o código de um amigo. Usa campos HTML por cima do jogo.
 */
export class OnlineMenuScene extends Phaser.Scene {
  constructor() { super('OnlineMenu'); }

  create() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1433, 0x1a1433, 0x2a1d47, 0x2a1d47, 1);
    g.fillRect(0, 0, GAME_W, GAME_H);
    this.add.text(GAME_W / 2, 50, 'JOGAR ONLINE', titleStyle(20)).setOrigin(0.5);
    this.add.text(GAME_W / 2, 84, 'Crie uma sala e passe o código para até 3 amigos, ou entre com um código.', textStyle(22, '#cfc8ef')).setOrigin(0.5);
    this.input.keyboard.disableGlobalCapture();
    this.client = OnlineClient.get();
    this.buildForm();
    this.events.once('shutdown', () => { this.form?.remove(); this.input.keyboard.enableGlobalCapture(); });
  }

  buildForm() {
    const saved = (() => { try { return localStorage.getItem('antares_nome') || ''; } catch { return ''; } })();
    const form = document.createElement('div');
    form.innerHTML = `
      <style>
        #onl { position: fixed; left: 50%; top: 54%; transform: translate(-50%, -50%); width: min(520px, 92vw);
               background: #1d1a2bee; border: 3px solid #5a4f80; padding: 18px 22px; font-family: 'VT323', monospace;
               color: #f4f0ff; font-size: 24px; box-shadow: 6px 6px 0 #0008; }
        #onl label { display: block; margin: 6px 0 4px; color: #ffd23f; }
        #onl input { width: 100%; box-sizing: border-box; font: inherit; font-size: 26px; padding: 6px 10px; background: #0d0b14;
                     color: #fff; border: 2px solid #5a4f80; outline: none; text-transform: none; }
        #onl input:focus { border-color: #ffd23f; }
        #onl .row { display: flex; gap: 10px; margin-top: 12px; }
        #onl button { flex: 1; font-family: 'Press Start 2P', monospace; font-size: 12px; padding: 12px 8px; cursor: pointer;
                      background: #3b3260; color: #fff; border: 2px solid #1b1424; box-shadow: 3px 3px 0 #0006; }
        #onl button:hover { background: #6b4fd8; }
        #onl button.sec { background: #2a2540; }
        #onl .msg { min-height: 28px; margin-top: 10px; color: #ff9a9a; }
        #onl hr { border: 0; border-top: 2px dashed #5a4f80; margin: 16px 0 6px; }
        #onl #code { text-transform: uppercase; letter-spacing: 6px; }
      </style>
      <div id="onl">
        <label for="nome">Seu nome</label>
        <input id="nome" maxlength="14" placeholder="Ex.: Ana" value="${saved.replace(/"/g, '')}">
        <div class="row"><button id="criar">CRIAR SALA</button></div>
        <hr>
        <label for="code">Código da sala</label>
        <input id="code" maxlength="4" placeholder="ABCD" autocomplete="off">
        <div class="row"><button id="entrar">ENTRAR</button><button id="voltar" class="sec">VOLTAR</button></div>
        <div class="msg" id="msg"></div>
      </div>`;
    document.body.appendChild(form);
    this.form = form;
    const $ = (id) => form.querySelector('#' + id);
    const msg = (t, ok = false) => { $('msg').style.color = ok ? '#5ee05e' : '#ff9a9a'; $('msg').textContent = t; };
    if (this.client.error) msg(this.client.error);
    else if (!this.client.connected) {
      msg('Conectando ao servidor...', true);
      const off = this.client.on('connect', () => { msg('Conectado!', true); off(); });
    }
    const name = () => {
      const n = $('nome').value.trim().slice(0, 14);
      try { localStorage.setItem('antares_nome', n); } catch { /* sem armazenamento */ }
      return n;
    };
    let busy = false;
    const go = async (fn) => {
      if (busy) return;
      busy = true;
      sound.unlock();
      const r = await fn();
      busy = false;
      if (!r.ok) { msg(r.error || 'Não foi possível conectar.'); return; }
      sound.play('select');
      this.scene.start('Lobby', { mode: 'online' });
    };
    $('criar').onclick = () => go(() => this.client.create(name()));
    $('entrar').onclick = () => {
      const code = $('code').value.trim().toUpperCase();
      if (code.length !== 4) { msg('O código tem 4 letras.'); return; }
      go(() => this.client.join(code, name()));
    };
    $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('entrar').click(); });
    $('voltar').onclick = () => this.scene.start('Menu');
    setTimeout(() => (saved ? $('code') : $('nome')).focus(), 50);
  }
}
