/** Mantém o jogo sem zoom de gestos, inclusive sobre botões e áreas fora do canvas. */
export function setupViewport(doc = document, win = window) {
  const button = doc.getElementById('fullscreen-toggle');
  const status = doc.getElementById('fullscreen-status');
  const root = doc.documentElement;
  const fullscreenElement = () => doc.fullscreenElement || doc.webkitFullscreenElement;
  let timer;
  const message = (text) => {
    win.clearTimeout(timer);
    status.textContent = text;
    timer = win.setTimeout(() => { status.textContent = ''; }, 8000);
  };
  const sync = () => {
    const active = !!fullscreenElement();
    button.textContent = active ? 'Sair da tela cheia' : 'Tela cheia';
    button.setAttribute('aria-pressed', String(active));
    // Phaser acompanha as dimensões do contêiner ao entrar/sair e ao girar a tela.
    win.__game?.scale.refresh();
  };
  button.addEventListener('click', async () => {
    try {
      if (fullscreenElement()) {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (exit) await exit.call(doc);
      } else {
        const enter = root.requestFullscreen || root.webkitRequestFullscreen;
        if (!enter) {
          message('Para tela cheia neste navegador: Compartilhar → Adicionar à Tela de Início. O zoom por gestos já está bloqueado.');
          return;
        }
        await enter.call(root);
      }
      sync();
    } catch {
      message('O navegador não permitiu tela cheia. Tente abrir o jogo diretamente ou adicionar à Tela de Início.');
      sync();
    }
    button.blur();
  });
  for (const name of ['fullscreenchange', 'webkitfullscreenchange']) doc.addEventListener(name, sync);
  const prevent = e => { if (e.cancelable) e.preventDefault(); };
  // Safari envia eventos próprios para a pinça, mesmo quando ignora a meta viewport.
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
    doc.addEventListener(name, prevent, { passive: false });
  }
  doc.addEventListener('touchmove', e => {
    if (e.touches.length > 1) prevent(e);
  }, { passive: false });
  // Compatibilidade com navegadores que ainda aplicam zoom por toque duplo.
  let previousTap = null;
  doc.addEventListener('touchend', e => {
    if (e.touches.length || e.changedTouches.length !== 1) { previousTap = null; return; }
    const touch = e.changedTouches[0];
    const now = win.performance.now();
    if (previousTap && now - previousTap.time < 300 && previousTap.target === e.target &&
        Math.hypot(touch.clientX - previousTap.x, touch.clientY - previousTap.y) < 24) prevent(e);
    previousTap = { time: now, target: e.target, x: touch.clientX, y: touch.clientY };
  }, { passive: false });
  sync();
}

if (typeof document !== 'undefined') setupViewport();
