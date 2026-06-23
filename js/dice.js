// Dados de batalha Root — Three.js ES Module (carregado lazy)
// Coloque batalha.stl e capanga.stl em assets/dice/ para modelos personalizados

const ROOT_FACES = [0, 0, 1, 1, 2, 3];

let THREE = null, STLLoader = null;
let renderer = null, scene = null, camera = null;
let die1 = null, die2 = null;
let animFrame = null;
let rolling = false, rollT = 0, rollResult = null, pulsed = false;
let lastTs = 0, ready = false;

const ease   = t => t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
const easeOut = t => 1-Math.pow(1-t, 3);

// ── Carrega Three.js de forma lazy ────────────────────────────────────────────
async function ensureThree() {
  if (THREE) return true;
  try {
    const [threeModule, stlModule] = await Promise.all([
      import('three'),
      import('three/addons/loaders/STLLoader.js'),
    ]);
    THREE    = threeModule;
    STLLoader = stlModule.STLLoader;
    return true;
  } catch (e) {
    const el = document.getElementById('diceStatus');
    if (el) el.textContent = 'Erro ao carregar Three.js: ' + e.message;
    return false;
  }
}

// ── Textura de face para dado fallback ────────────────────────────────────────
function makeFaceTex(value, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1209';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = color; ctx.lineWidth = 16;
  ctx.beginPath();
  const r = 40, x = 10, y = 10, w = 236, h = 236;
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 148px Georgia,serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 128);
  return new THREE.CanvasTexture(c);
}

function fallbackDie(color) {
  const vals = [3, 0, 2, 1, 1, 0]; // +x,-x,+y,-y,+z,-z
  const mats = vals.map(v => new THREE.MeshStandardMaterial({ map: makeFaceTex(v, color) }));
  return new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), mats);
}

// ── Carrega STL ───────────────────────────────────────────────────────────────
async function loadSTL(url, color) {
  return new Promise(resolve => {
    try {
      new STLLoader().load(url, geo => {
        geo.computeVertexNormals(); geo.center();
        const box = new THREE.Box3().setFromObject(new THREE.Mesh(geo));
        const sz  = new THREE.Vector3(); box.getSize(sz);
        const s = 1.3 / Math.max(sz.x, sz.y, sz.z);
        geo.scale(s, s, s);
        resolve(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.12 })));
      }, undefined, () => resolve(null));
    } catch { resolve(null); }
  });
}

// ── Inicializa cena ───────────────────────────────────────────────────────────
async function initScene() {
  if (!await ensureThree()) return;

  const canvas = document.getElementById('diceCanvas');
  if (!canvas) return;

  const W = canvas.parentElement?.clientWidth || 300;
  const H = 240;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(48, W/H, 0.1, 100);
  camera.position.z = 5.8;

  scene.add(new THREE.AmbientLight(0xfff8e7, 0.65));
  const sun = new THREE.DirectionalLight(0xfff0cc, 1.3); sun.position.set(5,10,7); scene.add(sun);
  const fill= new THREE.DirectionalLight(0xc8a050, 0.45); fill.position.set(-5,-3,-6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x4090d0, 0.25); rim.position.set(0,-6,3); scene.add(rim);

  const status = document.getElementById('diceStatus');
  if (status) status.textContent = 'Carregando modelos...';

  const [stl1, stl2] = await Promise.all([
    loadSTL('assets/dice/batalha.stl', '#c8a050'),
    loadSTL('assets/dice/capanga.stl', '#e08030'),
  ]);

  die1 = stl1 || fallbackDie('#c8a050');
  die2 = stl2 || fallbackDie('#e08030');
  die1.position.set(-1.65, 0, 0); die1.rotation.set(0.5, 0.3, 0.2);
  die2.position.set( 1.65, 0, 0); die2.rotation.set(-0.3, 0.8,-0.1);
  scene.add(die1, die2);

  if (status) status.textContent = (!stl1 && !stl2)
    ? 'Adicione batalha.stl e capanga.stl em assets/dice/ para modelos 3D personalizados'
    : '';

  ready = true;
  requestAnimationFrame(loop);
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop(ts) {
  animFrame = requestAnimationFrame(loop);
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  if (rolling) {
    rollT = Math.min(rollT + dt / 2.4, 1);
    const t = rollT;
    let x1, x2;
    if (t < 0.40) {
      const p = ease(t / 0.40);
      x1 = -1.65 + 1.3*p; x2 = 1.65 - 1.3*p;
    } else if (t < 0.52) {
      x1 = -0.35; x2 = 0.35;
      if (!pulsed) {
        pulsed = true;
        die1.scale.setScalar(1.2); die2.scale.setScalar(1.2);
        setTimeout(() => { if (die1) { die1.scale.setScalar(1); die2.scale.setScalar(1); } }, 130);
      }
    } else {
      const p = easeOut((t-0.52)/0.48);
      x1 = -0.35 - 1.3*p; x2 = 0.35 + 1.3*p;
    }
    die1.position.x = x1; die2.position.x = x2;

    const spin = t < 0.46 ? 10 : t < 0.88 ? 10*(1-(t-0.46)/0.42) : 0;
    die1.rotation.x += dt*spin*1.2; die1.rotation.y += dt*spin*0.75;
    die2.rotation.x += dt*spin*0.85; die2.rotation.y += dt*spin*1.35; die2.rotation.z += dt*spin*0.4;

    if (rollT >= 1) {
      rolling = false;
      die1.position.x = -1.65; die2.position.x = 1.65;
      showResult();
    }
  } else {
    if (die1) { die1.rotation.y += dt*0.38; die1.rotation.x += dt*0.09; }
    if (die2) { die2.rotation.y -= dt*0.30; die2.rotation.x += dt*0.13; }
  }
  renderer?.render(scene, camera);
}

function showResult() {
  const [r1, r2] = rollResult;
  const atk = Math.max(r1, r2), def = Math.min(r1, r2);
  const el = document.getElementById('diceResultBox');
  if (!el) return;
  el.style.display = 'flex';
  el.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:2.4rem;font-family:Georgia,serif;font-weight:bold;color:#f0801a;line-height:1">${atk}</div>
      <div style="font-size:0.65rem;letter-spacing:.08em;color:var(--text3);font-family:sans-serif;margin-top:3px">⚔ ATACANTE</div>
    </div>
    <div style="font-size:1.1rem;color:var(--text3);align-self:center">vs</div>
    <div style="text-align:center;">
      <div style="font-size:2.4rem;font-family:Georgia,serif;font-weight:bold;color:#4090d0;line-height:1">${def}</div>
      <div style="font-size:0.65rem;letter-spacing:.08em;color:var(--text3);font-family:sans-serif;margin-top:3px">🛡 DEFENSOR</div>
    </div>`;
}

// ── API global ────────────────────────────────────────────────────────────────
window.abrirDiceDrawer = function() {
  const drawer  = document.getElementById('diceDrawer');
  const overlay = document.getElementById('diceOverlay');
  if (!drawer) return;
  drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (!ready) initScene();
  else if (!animFrame) requestAnimationFrame(loop);
};

window.fecharDiceDrawer = function() {
  document.getElementById('diceDrawer')?.classList.remove('open');
  document.getElementById('diceOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
};

window.rolarDados = function() {
  if (rolling || !ready) return;
  rollResult = [
    ROOT_FACES[Math.floor(Math.random() * ROOT_FACES.length)],
    ROOT_FACES[Math.floor(Math.random() * ROOT_FACES.length)],
  ];
  rollT = 0; pulsed = false; rolling = true;
  const el = document.getElementById('diceResultBox');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
};
