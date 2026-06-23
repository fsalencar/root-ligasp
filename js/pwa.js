// PWA: registro do service worker + botão de instalação

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

let _installPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _installPrompt = e;
  const btn = document.getElementById('btnInstallPWA');
  if (btn) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  const btn = document.getElementById('btnInstallPWA');
  if (btn) btn.style.display = 'none';
});

async function instalarPWA() {
  if (_installPrompt) {
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    _installPrompt = null;
    if (outcome === 'accepted') {
      const btn = document.getElementById('btnInstallPWA');
      if (btn) btn.style.display = 'none';
    }
    return;
  }
  // iOS: não tem beforeinstallprompt, precisa de instrução manual
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    alert('No iPhone/iPad: toque no ícone de Compartilhar (📤) e escolha "Adicionar à Tela de Início".');
  }
}
