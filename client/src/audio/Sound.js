/**
 * Efeitos sonoros e música chiptune sintetizados com Web Audio (sem arquivos de áudio).
 * Para trocar por arquivos .ogg/.mp3 depois, basta substituir play()/playMusic().
 */
const NOTE_INDEX = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
function noteFreq(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE_INDEX[m[1]] + (Number(m[2]) - 4) * 12) / 12);
}

// Músicas: cada trilha tem passos de 1/16; "." = pausa; "-" = sustenta a nota anterior.
const TRACKS = {
  menu: {
    bpm: 112,
    lead: 'E5 . G5 . C6 . G5 . A5 . F5 . A5 C6 B5 . G5 . D5 . G5 . E5 . G5 . C6 . G5 . A5 . F5 . A5 . G5 - - - . . . .',
    bass: 'C3 . . . C3 . . . F2 . . . F2 . . . G2 . . . G2 . . . C3 . . . C3 . . . F2 . . . F2 . . . G2 . . . G2 . . .',
    drums: 'k . h . s . h . k . h . s . h h'
  },
  dungeon: {
    bpm: 138,
    lead: 'A4 . C5 . E5 . A5 . G5 . E5 . C5 . D5 . E5 . . . G4 . B4 . D5 . G5 . F5 . D5 . B4 . C5 . D5 . . . ' +
          'F4 . A4 . C5 . F5 . E5 . C5 . A4 . B4 . C5 . . . E4 . G#4 . B4 . E5 . D5 . B4 . G#4 . A4 . B4 . . . ',
    bass: 'A2 . A2 . A3 . A2 . A2 . A2 . A3 . A2 . G2 . G2 . G3 . G2 . G2 . G2 . G3 . G2 . ' +
          'F2 . F2 . F3 . F2 . F2 . F2 . F3 . F2 . E2 . E2 . E3 . E2 . E2 . E2 . G#2 . B2 . ',
    drums: 'k . h . s . h k k . h . s . h h'
  },
  boss: {
    bpm: 164,
    lead: 'E5 E5 . E5 . G5 . E5 D5 . C5 . B4 . C5 D5 E5 E5 . E5 . G5 . A5 B5 . A5 . G5 . E5 . ' +
          'C5 C5 . C5 . E5 . C5 B4 . A4 . G4 . A4 B4 C5 . D5 . E5 . F#5 . G5 . F#5 . E5 . D#5 . ',
    bass: 'E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 D2 D3 C2 C3 C2 C3 C2 C3 C2 C3 B1 B2 B1 B2 B1 B2 D#2 D#3 ',
    drums: 'k h s h k k s h k h s h k k s s'
  },
  victory: {
    bpm: 130,
    lead: 'C5 . E5 . G5 . C6 - - . G5 . C6 - - - D6 . C6 . B5 . C6 - - - - - - - . . .',
    bass: 'C3 . . . . . . . . . . . . . . . G2 . . . . . . . C3 . . . . . . .',
    drums: 'k . . . s . . . k . . . s . . .',
    loop: false
  },
  defeat: {
    bpm: 90,
    lead: 'E5 . D#5 . D5 . C#5 - - - - - . . . .',
    bass: 'A2 . . . G#2 . . . G2 . . . F#2 - - -',
    drums: '. . . . . . . . . . . . . . . .',
    loop: false
  }
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('antares_mute') === '1';
    this.last = {};
    this.track = null;
    this.musicTimer = null;
  }

  /** Precisa ser chamado depois de um clique/tecla (regra dos navegadores). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.pendingTrack) this.playMusic(this.pendingTrack);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('antares_mute', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  tone(type, f0, f1, dur, vol = 0.2, when = 0, dest = this.sfxGain) {
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, filterFreq = 2000, type = 'lowpass', when = 0, dest = this.sfxGain) {
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  /** Toca um efeito pelo nome (com limite de repetição para não estourar o som). */
  play(name, minGap = 0.04) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < minGap) return;
    this.last[name] = now;
    const r = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'shoot': this.tone('square', 880 * r, 330, 0.07, 0.07); break;
      case 'shoot_heavy': this.tone('square', 220 * r, 60, 0.18, 0.12); this.noise(0.15, 0.12, 900); break;
      case 'shoot_magic': this.tone('sine', 1200 * r, 600, 0.12, 0.08); this.tone('triangle', 600 * r, 1200, 0.1, 0.05); break;
      case 'shoot_throw': this.tone('triangle', 500 * r, 900, 0.08, 0.08); break;
      case 'swing': this.noise(0.12, 0.14, 3000, 'highpass'); this.tone('triangle', 300, 150, 0.1, 0.06); break;
      case 'hit': this.tone('square', 260 * r, 120, 0.05, 0.06); break;
      case 'crit': this.tone('square', 520, 1040, 0.08, 0.08); break;
      case 'enemy_die': this.tone('square', 440, 110, 0.18, 0.08); this.noise(0.12, 0.08, 1500); break;
      case 'enemy_shoot': this.tone('sawtooth', 500 * r, 250, 0.08, 0.035); break;
      case 'player_hurt': this.tone('sawtooth', 220, 70, 0.25, 0.16); this.noise(0.12, 0.1, 800); break;
      case 'shield_hit': this.tone('triangle', 900, 400, 0.12, 0.1); break;
      case 'pickup': this.tone('square', 660, 660, 0.06, 0.06); this.tone('square', 990, 990, 0.08, 0.06, 0.06); break;
      case 'coin': this.tone('square', 988, 988, 0.05, 0.05); this.tone('square', 1319, 1319, 0.12, 0.05, 0.05); break;
      case 'energy': this.tone('sine', 1100 * r, 1500, 0.06, 0.06); break;
      case 'apple': this.tone('triangle', 520, 780, 0.1, 0.1); this.tone('triangle', 780, 1040, 0.12, 0.1, 0.08); break;
      case 'weapon': this.tone('square', 330, 330, 0.06, 0.08); this.tone('square', 495, 495, 0.06, 0.08, 0.06); this.tone('square', 660, 660, 0.1, 0.08, 0.12); break;
      case 'swap': this.tone('triangle', 400, 600, 0.06, 0.06); break;
      case 'door_close': this.tone('square', 140, 70, 0.25, 0.14); this.noise(0.2, 0.1, 500); break;
      case 'door_open': this.tone('square', 200, 400, 0.18, 0.1); this.tone('square', 400, 800, 0.15, 0.08, 0.12); break;
      case 'chest': [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.12, 0.08, i * 0.08)); break;
      case 'heal': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.1, i * 0.07)); break;
      case 'explosion': this.noise(0.45, 0.25, 700); this.tone('sine', 120, 40, 0.4, 0.2); break;
      case 'shock': this.noise(0.15, 0.12, 4000, 'highpass'); this.tone('sawtooth', 1500, 800, 0.1, 0.04); break;
      case 'skill': this.tone('sawtooth', 300, 1200, 0.3, 0.1); this.tone('square', 600, 2400, 0.25, 0.05, 0.05); break;
      case 'equation': [523, 659, 784].forEach((f, i) => this.tone('square', f * 2, f * 2, 0.08, 0.06, i * 0.05)); break;
      case 'big_hit': this.tone('square', 1046, 261, 0.3, 0.15); this.noise(0.25, 0.15, 1200); break;
      case 'no_energy': this.tone('square', 120, 100, 0.08, 0.08); break;
      case 'not_ready': this.tone('square', 180, 160, 0.05, 0.04); break;
      case 'boss_roar': this.tone('sawtooth', 110, 55, 0.9, 0.2); this.tone('square', 82, 41, 0.9, 0.12); this.noise(0.8, 0.1, 400); break;
      case 'boss_dash': this.noise(0.4, 0.14, 1200, 'bandpass'); this.tone('sawtooth', 200, 400, 0.3, 0.08); break;
      case 'crash': this.noise(0.4, 0.25, 500); this.tone('square', 90, 40, 0.3, 0.15); break;
      case 'splash': this.noise(0.25, 0.14, 600); break;
      case 'deflect': this.tone('triangle', 1400, 1800, 0.06, 0.08); break;
      case 'revive': [440, 554, 659, 880].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.1, i * 0.08)); break;
      case 'down': this.tone('sawtooth', 300, 60, 0.6, 0.15); break;
      case 'spawn': this.tone('sine', 200 * r, 600, 0.2, 0.04); break;
      case 'portal': this.tone('sine', 300, 1200, 0.6, 0.12); this.tone('triangle', 600, 2400, 0.6, 0.06); break;
      case 'click': this.tone('square', 700, 700, 0.03, 0.06); break;
      case 'select': this.tone('square', 523, 523, 0.05, 0.07); this.tone('square', 784, 784, 0.08, 0.07, 0.05); break;
      case 'bounce': this.tone('triangle', 700 * r, 500, 0.04, 0.04); break;
      case 'crate': this.noise(0.15, 0.16, 1800); this.tone('square', 180 * r, 90, 0.1, 0.06); break;
      case 'bell': [1568, 1760, 1568, 1760].forEach((f, i) => this.tone('square', f, f, 0.06, 0.04, i * 0.06)); break;
      case 'whistle': this.tone('sine', 2200, 2400, 0.25, 0.1); this.tone('sine', 2400, 2200, 0.2, 0.1, 0.25); break;
      case 'fuse': this.noise(0.4, 0.08, 5000, 'highpass'); break;
      case 'bite': this.tone('square', 300, 120, 0.08, 0.1); this.noise(0.05, 0.1, 2000); break;
      default: break;
    }
  }

  playMusic(name) {
    if (!this.ctx) { this.pendingTrack = name; return; }
    if (this.track === name) return;
    this.stopMusic();
    const tr = TRACKS[name];
    if (!tr) return;
    this.track = name;
    const parse = (s) => s.trim().split(/\s+/);
    const lead = parse(tr.lead), bass = parse(tr.bass), drums = parse(tr.drums);
    const stepDur = 60 / tr.bpm / 4;
    const total = Math.max(lead.length, bass.length);
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.1;
    const schedule = () => {
      while (nextTime < this.ctx.currentTime + 0.2) {
        if (tr.loop === false && step >= total) { this.stopMusic(); return; }
        const i = step % total;
        const when = nextTime - this.ctx.currentTime;
        const sustain = (arr, idx) => {
          let n = 1;
          while (arr[(idx + n) % arr.length] === '-' && n < 16) n++;
          return n;
        };
        const l = lead[i % lead.length];
        if (l && l !== '.' && l !== '-') this.tone('square', noteFreq(l), 0, stepDur * sustain(lead, i % lead.length) * 0.9, 0.09, when, this.musicGain);
        const b = bass[i % bass.length];
        if (b && b !== '.' && b !== '-') this.tone('triangle', noteFreq(b), 0, stepDur * sustain(bass, i % bass.length) * 0.95, 0.22, when, this.musicGain);
        const d = drums[i % drums.length];
        if (d === 'k') this.tone('sine', 150, 45, 0.12, 0.35, when, this.musicGain);
        else if (d === 's') this.noise(0.1, 0.18, 2500, 'highpass', when, this.musicGain);
        else if (d === 'h') this.noise(0.03, 0.08, 7000, 'highpass', when, this.musicGain);
        nextTime += stepDur;
        step++;
      }
    };
    schedule();
    this.musicTimer = setInterval(schedule, 40);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.track = null;
  }
}

export const sound = new Sound();
