/**
 * Conexão com o servidor (Socket.io). Uma única conexão é usada no menu online, no lobby e na partida.
 * O script /socket.io/socket.io.min.js é servido pelo próprio servidor do jogo.
 */
let instance = null;

export class OnlineClient {
  static get() {
    if (!instance) instance = new OnlineClient();
    return instance;
  }

  constructor() {
    if (typeof window.io !== 'function') {
      this.error = 'Modo online indisponível: abra o jogo pelo servidor (npm start ou Render).';
      this.socket = null;
      return;
    }
    this.socket = window.io({ transports: ['websocket', 'polling'] });
    this.code = null;
    this.playerId = null;
    this.roomState = null;
    this.handlers = {};
    this.socket.on('room:state', (s) => { this.roomState = s; this.emitLocal('room:state', s); });
    for (const ev of ['game:start', 'game:map', 'game:snap', 'game:end']) this.socket.on(ev, (d) => this.emitLocal(ev, d));
    this.socket.on('connect', () => this.emitLocal('connect'));
    this.socket.on('disconnect', () => this.emitLocal('disconnect'));
  }

  get connected() { return !!this.socket?.connected; }

  on(ev, fn) { (this.handlers[ev] ||= new Set()).add(fn); return () => this.handlers[ev]?.delete(fn); }
  emitLocal(ev, d) { for (const fn of this.handlers[ev] || []) fn(d); }

  request(ev, payload) {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ ok: false, error: this.error });
      const t = setTimeout(() => resolve({ ok: false, error: 'O servidor não respondeu. Tente de novo.' }), 8000);
      this.socket.emit(ev, payload, (res) => { clearTimeout(t); resolve(res || { ok: false }); });
    });
  }

  async create(name) {
    const r = await this.request('room:create', { name });
    if (r.ok) { this.code = r.code; this.playerId = r.playerId; }
    return r;
  }

  async join(code, name) {
    const r = await this.request('room:join', { code, name });
    if (r.ok) { this.code = r.code; this.playerId = r.playerId; }
    return r;
  }

  setCharacter(id) { return this.request('lobby:character', id); }
  setReady(ready) { return this.request('lobby:ready', ready); }
  sendInput(input, seq) { this.socket?.volatile.emit('input', { i: input, s: seq }); }
  sendInputReliable(input, seq) { this.socket?.emit('input', { i: input, s: seq }); }

  leave() {
    this.socket?.emit('room:leave');
    this.code = null;
    this.playerId = null;
    this.roomState = null;
  }
}
