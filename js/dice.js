// Dados de batalha Root — Three.js r150 UMD
// Modelos STL em assets/dice/batalha.stl e assets/dice/capanga.stl
// Fallback automático para dados cúbicos se STL não encontrado

const _ROOT_FACES = [0, 0, 1, 1, 2, 3]; // distribuição real do dado de Root

let _T = null;           // Three namespace
let _renderer = null, _scene = null, _camera = null;
let _die1 = null, _die2 = null;
let _animFrame = null;
let _rolling = false;
let _rollT = 0;
let _rollResult = null;
let _lastTs = 0;
let _pulsed = false;
let _ready = false;

// ── Utils ─────────────────────────────────────────────────────────────────────
function _ease(t) { return t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }
function _easeOut(t) { return 1-Math.pow(1-t,3); }

async function _loadScript(src) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── Dado fallback (cubo texturizado) ─────────────────────────────────────────
function _makeFaceTex(value, gold) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1209';
  ctx.fillRect(0,0,256,256);
  // borda arredondada
  ctx.strokeStyle = gold;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.roundRect(10,10,236,236,40);
  ctx.stroke();
  // número
  ctx.fillStyle = gold;
  ctx.font = 'bold 148px Georgia,serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 128);
  return new _T.CanvasTexture(c);
}

function _fallbackDie(color) {
  // Faces: +x,-x,+y,-y,+z,-z → [3,0,2,1,1,0] valores dos lados
  const vals = [3, 0, 2, 1, 1, 0];
  const mats = vals.map(v => new _T.MeshStandardMaterial({ map: _makeFaceTex(v, color) }));
  return new _T.Mesh(new _T.BoxGeometry(1.15,1.15,1.15), mats);
}

// ── Carregador STL ────────────────────────────────────────────────────────────
async function _loadSTL(url, color) {
  return new Promise(resolve => {
    if (!_T.STLLoader) { resolve(null); return; }
    new _T.STLLoader().load(url, geo => {
      geo.computeVertexNormals();
      geo.center();
      const box = new _T.Box3().setFromObject(new _T.Mesh(geo));
      const sz  = new _T.Vector3();
      box.getSize(sz);
      const s = 1.3 / Math.max(sz.x, sz.y, sz.z);
      geo.scale(s,s,s);
      const mat = new _T.MeshStandardMaterial({
        color, roughness: 0.25, metalness: 0.12,
      });
      resolve(new _T.Mesh(geo, mat));
    }, undefined, () => resolve(null));
  });
}

// ── Cena Three.js ─────────────────────────────────────────────────────────────
async function _initScene() {
  const status = document.getElementById('diceStatus');
  try {
    await _loadScript('https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js');
    await _loadScript('https://cdn.jsdelivr.net/npm/three@0.150.1/examples/js/loaders/STLLoader.js');
  } catch {
    if (status) status.textContent = 'Erro ao carregar Three.js.';
    return;
  }
  _T = window.THREE;

  const canvas = document.getElementById('diceCanvas');
  if (!canvas) return;

  const W = canvas.offsetWidth || 300;
  const H = 240;
  canvas.width  = W * Math.min(devicePixelRatio, 2);
  canvas.height = H * Math.min(devicePixelRatio, 2);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  _renderer = new _T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  _renderer.setSize(W, H);
  _renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  _renderer.setClearColor(0,0);

  _scene  = new _T.Scene();
  _camera = new _T.PerspectiveCamera(48, W/H, 0.1, 100);
  _camera.position.z = 5.8;

  // Luzes
  _scene.add(new _T.AmbientLight(0xfff8e7, 0.65));
  const sun = new _T.DirectionalLight(0xfff0cc, 1.3);
  sun.position.set(5, 10, 7); _scene.add(sun);
  const fill = new _T.DirectionalLight(0xc8a050, 0.45);
  fill.position.set(-5,-3,-6); _scene.add(fill);
  const rim = new _T.DirectionalLight(0x4090d0, 0.25);
  rim.position.set(0,-6, 3); _scene.add(rim);

  // Carrega STL ou usa fallback
  if (status) status.textContent = 'Carregando modelos...';
  const [stl1, stl2] = await Promise.all([
    _loadSTL('assets/dice/batalha.stl', '#c8a050'),
    _loadSTL('assets/dice/capanga.stl', '#e08030'),
  ]);

  _die1 = stl1 || _fallbackDie('#c8a050');
  _die2 = stl2 || _fallbackDie('#e08030');

  _die1.position.set(-1.65, 0, 0);
  _die2.position.set( 1.65, 0, 0);
  _die1.rotation.set(0.5, 0.3, 0.2);
  _die2.rotation.set(-0.3, 0.8,-0.1);

  _scene.add(_die1, _die2);

  if (status) {
    status.textContent = (!stl1 && !stl2)
      ? 'Adicione batalha.stl e capanga.stl em assets/dice/ para modelos 3D personalizados'
      : '';
  }

  _ready = true;
  requestAnimationFrame(_loop);
}

// ── Loop de animação ──────────────────────────────────────────────────────────
function _loop(ts) {
  _animFrame = requestAnimationFrame(_loop);
  const dt = Math.min((ts - _lastTs) / 1000, 0.05);
  _lastTs = ts;

  if (_rolling) {
    _rollT = Math.min(_rollT + dt / 2.4, 1);
    const t = _rollT;

    // Posição X: aproximação → colisão → separação
    let x1, x2;
    if (t < 0.40) {
      const p = _ease(t / 0.40);
      x1 = -1.65 + 1.3 * p;
      x2 =  1.65 - 1.3 * p;
    } else if (t < 0.52) {
      x1 = -0.35; x2 = 0.35;
      if (!_pulsed) {
        _pulsed = true;
        [_die1, _die2].forEach(d => d.scale.setScalar(1.2));
        setTimeout(() => { if (_die1) [_die1,_die2].forEach(d => d.scale.setScalar(1)); }, 120);
      }
    } else {
      const p = _easeOut((t - 0.52) / 0.48);
      x1 = -0.35 - 1.3 * p;
      x2 =  0.35 + 1.3 * p;
    }
    _die1.position.x = x1;
    _die2.position.x = x2;

    // Velocidade de spin: rápido até 0.46, desacelera até 0.88, para
    const spin = t < 0.46 ? 10
      : t < 0.88 ? 10 * (1-(t-0.46)/0.42)
      : 0;
    _die1.rotation.x += dt * spin * 1.2;
    _die1.rotation.y += dt * spin * 0.75;
    _die2.rotation.x += dt * spin * 0.85;
    _die2.rotation.y += dt * spin * 1.35;
    _die2.rotation.z += dt * spin * 0.45;

    if (_rollT >= 1) {
      _rolling = false;
      _die1.position.x = -1.65;
      _die2.position.x =  1.65;
      _showResult();
    }
  } else {
    // Rotação suave em idle
    if (_die1) { _die1.rotation.y += dt*0.38; _die1.rotation.x += dt*0.09; }
    if (_die2) { _die2.rotation.y -= dt*0.30; _die2.rotation.x += dt*0.13; }
  }

  _renderer?.render(_scene, _camera);
}

function _showResult() {
  const [r1, r2] = _rollResult;
  const atk = Math.max(r1, r2);
  const def = Math.min(r1, r2);
  const el = document.getElementById('diceResultBox');
  if (!el) return;
  el.style.display = 'flex';
  el.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:2.4rem;font-family:Georgia,serif;font-weight:bold;color:#f0801a;line-height:1;">${atk}</div>
      <div style="font-size:0.65rem;letter-spacing:0.08em;color:var(--text3);font-family:sans-serif;margin-top:3px;">⚔ ATACANTE</div>
    </div>
    <div style="font-size:1.1rem;color:var(--text3);align-self:center;">vs</div>
    <div style="text-align:center;">
      <div style="font-size:2.4rem;font-family:Georgia,serif;font-weight:bold;color:#4090d0;line-height:1;">${def}</div>
      <div style="font-size:0.65rem;letter-spacing:0.08em;color:var(--text3);font-family:sans-serif;margin-top:3px;">🛡 DEFENSOR</div>
    </div>`;
}

// ── API pública ───────────────────────────────────────────────────────────────
function abrirDiceDrawer() {
  const drawer  = document.getElementById('diceDrawer');
  const overlay = document.getElementById('diceOverlay');
  if (!drawer) return;
  drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!_ready) _initScene();
  else if (!_animFrame) requestAnimationFrame(_loop);
}

function fecharDiceDrawer() {
  const drawer  = document.getElementById('diceDrawer');
  const overlay = document.getElementById('diceOverlay');
  if (drawer)  drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
}

function rolarDados() {
  if (_rolling || !_ready) return;
  _rollResult = [
    _ROOT_FACES[Math.floor(Math.random() * _ROOT_FACES.length)],
    _ROOT_FACES[Math.floor(Math.random() * _ROOT_FACES.length)],
  ];
  _rollT    = 0;
  _pulsed   = false;
  _rolling  = true;
  const el = document.getElementById('diceResultBox');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}
