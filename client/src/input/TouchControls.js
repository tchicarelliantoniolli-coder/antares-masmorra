export function stickVector(dx, dy, radius) {
  const d = Math.hypot(dx, dy);
  if (d < radius * 0.15) return { x: 0, y: 0 };
  const scale = Math.min(1, d / radius) / d;
  return { x: dx * scale, y: dy * scale };
}

/** Cada analógico captura seu próprio dedo; cliques não chegam ao canvas. */
export class TouchControls {
  constructor(onPause) {
    this.move = { x: 0, y: 0 };
    this.aim = { x: 0, y: 0 };
    this.actions = new Set();
    this.sticks = [];
    this.enabled = true;
    this.root = document.createElement('div');
    this.root.className = 'touch-controls';
    for (const [name, label] of [['move', 'ANDAR'], ['aim', 'MIRAR / ATIRAR']]) {
      const base = document.createElement('div');
      base.className = 'touch-stick touch-' + name;
      base.innerHTML = '<span class="touch-knob"></span><span class="touch-caption">' + label + '</span>';
      base.setAttribute('aria-label', label);
      const knob = base.firstChild;
      const stick = { base, knob, pointer: null };
      this.sticks.push(stick);
      const update = e => {
        const r = base.getBoundingClientRect(), radius = r.width / 2;
        this[name] = stickVector(e.clientX - r.left - radius, e.clientY - r.top - radius, radius);
        knob.style.transform = 'translate(' + this[name].x * radius * 0.6 + 'px,' + this[name].y * radius * 0.6 + 'px)';
      };
      base.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (!this.enabled || stick.pointer !== null) return;
        stick.pointer = e.pointerId;
        base.setPointerCapture(e.pointerId);
        update(e);
      });
      base.addEventListener('pointermove', e => {
        if (stick.pointer !== e.pointerId) return;
        e.preventDefault(); e.stopPropagation(); update(e);
      });
      const release = e => {
        if (stick.pointer !== e.pointerId) return;
        stick.pointer = null;
        this[name] = { x: 0, y: 0 };
        knob.style.transform = '';
      };
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(event, release);
      this.root.append(base);
    }
    const actions = document.createElement('div');
    actions.className = 'touch-actions';
    for (const [action, label] of [['skill', 'Habilidade'], ['interact', 'Pegar'], ['swap', 'Trocar'], ['pause', 'Pausa']]) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        if (!this.enabled) return;
        if (action === 'pause') onPause(); else this.actions.add(action);
      });
      actions.append(b);
    }
    this.root.append(actions);
    document.body.append(this.root);
    this.onReset = () => this.reset();
    window.addEventListener('blur', this.onReset);
    window.addEventListener('resize', this.onReset);
    document.addEventListener('visibilitychange', this.onReset);
  }
  consume(action) {
    const pressed = this.actions.has(action);
    this.actions.delete(action);
    return pressed;
  }
  reset() {
    this.move = { x: 0, y: 0 }; this.aim = { x: 0, y: 0 };
    this.actions.clear();
    for (const s of this.sticks) {
      const id = s.pointer; s.pointer = null;
      if (id !== null && s.base.hasPointerCapture(id)) s.base.releasePointerCapture(id);
      s.knob.style.transform = '';
    }
  }
  setEnabled(value) {
    if (this.enabled === value) return;
    this.enabled = value; this.root.hidden = !value; this.reset();
  }
  destroy() {
    this.reset(); this.root.remove();
    window.removeEventListener('blur', this.onReset);
    window.removeEventListener('resize', this.onReset);
    document.removeEventListener('visibilitychange', this.onReset);
  }
}
