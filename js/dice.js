// Dados Root — Three.js ES Module
const ROOT_FACES = [0, 0, 1, 1, 2, 3];

// BoxGeometry face layout [+x,-x,+y,-y,+z,-z]
const BOX_FACE_VALUES = [3, 0, 2, 1, 1, 0];

let THREE = null;
let renderer = null, scene = null, camera = null;
let dice = [];
let animFrame = null;
let rolling = false, rollT = 0, rollResults = [], pulsed = false;
let landingStarted = false, landQuatStarts = [], targetQuats = [];
let showingResult = false;
let lastTs = 0, ready = false;
let diceMode = 'batalha';   // 'batalha' | 'capanga'
let colorScheme = 'white';  // 'white' | 'black'

const ease    = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const LAND_T  = 0.60;

const SCHEMES = {
  white: { body: '#f0ede8', num: '#111111' },
  black: { body: '#1a1209', num: '#c8a050' },
};

// ── Three.js lazy load ────────────────────────────────────────────────────────
async function ensureThree() {
  if (THREE) return true;
  try {
    THREE = await import('three');
    return true;
  } catch(e) {
    const el = document.getElementById('diceStatus');
    if (el) el.textContent = 'Erro Three.js: ' + e.message;
    return false;
  }
}

// ── Canvas texture para uma face ──────────────────────────────────────────────
function makeFaceTex(value, bodyColor, numColor) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bodyColor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = numColor; ctx.lineWidth = 14;
  ctx.beginPath();
  const r=38, x=7, y=7, w=242, h=242;
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle = numColor;
  ctx.font = 'bold 148px Georgia,serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 128);
  return new THREE.CanvasTexture(c);
}

// ── Cria um dado (BoxGeometry com texturas) ───────────────────────────────────
function makeDie() {
  const { body, num } = SCHEMES[colorScheme];
  const mats = BOX_FACE_VALUES.map(v =>
    new THREE.MeshStandardMaterial({ map: makeFaceTex(v, body, num), roughness: 0.30, metalness: 0.05 })
  );
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mats);
  mesh.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
  return mesh;
}

// ── Rotação alvo para que 'value' fique com face pra cima (+Y) ────────────────
// BOX_FACE_VALUES: +X=3, -X=0, +Y=2, -Y=1, +Z=1, -Z=0
// Rotação em Z para trazer cada face ao topo:
//   rotZ=0     → +Y acima (value 2)
//   rotZ=-π/2  → -X acima (value 0)
//   rotZ=+π    → -Y acima (value 1)
//   rotZ=+π/2  → +X acima (value 3)
function getFaceUpEuler(value) {
  const rY = Math.floor(Math.random() * 4) * Math.PI / 2;
  switch(value) {
    case 0: return new THREE.Euler(0, rY, -Math.PI / 2);
    case 1: return new THREE.Euler(0, rY,  Math.PI);
    case 2: return new THREE.Euler(0, rY,  0);
    case 3: return new THREE.Euler(0, rY,  Math.PI / 2);
    default: return new THREE.Euler(0, rY, 0);
  }
}

// ── Monta dados na cena conforme o modo ──────────────────────────────────────
function setupDice() {
  dice.forEach(d => scene.remove(d));
  dice = [];
  if (diceMode === 'batalha') {
    const d1 = makeDie(); d1.position.set(-1.65, 0, 0); scene.add(d1); dice.push(d1);
    const d2 = makeDie(); d2.position.set( 1.65, 0, 0); scene.add(d2); dice.push(d2);
  } else {
    const d1 = makeDie(); d1.position.set(0, 0, 0); scene.add(d1); dice.push(d1);
  }
}

// ── Atualiza materiais ao trocar cor ─────────────────────────────────────────
function rebuildDiceMaterials() {
  const { body, num } = SCHEMES[colorScheme];
  dice.forEach(die => {
    BOX_FACE_VALUES.forEach((v, i) => {
      die.material[i].map?.dispose();
      die.material[i].map = makeFaceTex(v, body, num);
      die.material[i].needsUpdate = true;
    });
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
  // Ligeiramente acima para ver a face de cima após o resultado
  camera.position.set(0, 1.8, 5.4);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xfff8e7, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(5,10,7); scene.add(sun);
  const fill= new THREE.DirectionalLight(0xc8a050, 0.4); fill.position.set(-5,-3,-6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x6099d0, 0.25); rim.position.set(0,-6,3); scene.add(rim);

  setupDice();
  ready = true;
  requestAnimationFrame(loop);
}

// ── Loop de animação ──────────────────────────────────────────────────────────
function loop(ts) {
  animFrame = requestAnimationFrame(loop);
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  if (rolling) {
    rollT = Math.min(rollT + dt / 2.4, 1);
    const t = rollT;

    // Animação de posição — só no modo batalha
    if (diceMode === 'batalha' && dice.length === 2) {
      let x1, x2;
      if (t < 0.40) {
        const p = ease(t / 0.40);
        x1 = -1.65 + 1.3*p; x2 = 1.65 - 1.3*p;
      } else if (t < 0.52) {
        x1 = -0.35; x2 = 0.35;
        if (!pulsed) {
          pulsed = true;
          dice.forEach(d => d.scale.setScalar(1.2));
          setTimeout(() => { if (dice.length) dice.forEach(d => d.scale.setScalar(1)); }, 130);
        }
      } else if (t < LAND_T) {
        const p = easeOut((t - 0.52) / (LAND_T - 0.52));
        x1 = -0.35 - 1.3*p; x2 = 0.35 + 1.3*p;
      } else {
        x1 = -1.65; x2 = 1.65;
      }
      dice[0].position.x = x1;
      dice[1].position.x = x2;
    }

    // Captura quaternion inicial da fase de pouso
    if (t >= LAND_T && !landingStarted) {
      landingStarted = true;
      landQuatStarts = dice.map(d => d.quaternion.clone());
    }

    if (!landingStarted) {
      // Fase de giro rápido
      const sp = 10;
      if (dice[0]) { dice[0].rotation.x += dt*sp*1.2; dice[0].rotation.y += dt*sp*0.75; }
      if (dice[1]) { dice[1].rotation.x += dt*sp*0.85; dice[1].rotation.y += dt*sp*1.35; dice[1].rotation.z += dt*sp*0.4; }
    } else {
      // Fase de pouso: slerp até a face alvo
      const p = easeOut((t - LAND_T) / (1 - LAND_T));
      dice.forEach((d, i) => {
        if (targetQuats[i]) d.quaternion.slerpQuaternions(landQuatStarts[i], targetQuats[i], p);
      });
    }

    if (rollT >= 1) {
      rolling = false;
      showingResult = true;
      // Snap para rotação exata
      dice.forEach((d, i) => { if (targetQuats[i]) d.quaternion.copy(targetQuats[i]); });
      if (diceMode === 'batalha' && dice.length === 2) {
        dice[0].position.x = -1.65; dice[1].position.x = 1.65;
      }
      showResult();
    }

  } else if (!showingResult) {
    // Idle — rotação suave enquanto aguarda rolar
    if (dice[0]) { dice[0].rotation.y += dt*0.35; dice[0].rotation.x += dt*0.09; }
    if (dice[1]) { dice[1].rotation.y -= dt*0.28; dice[1].rotation.x += dt*0.12; }
  }

  renderer?.render(scene, camera);
}

// ── Exibe resultado ───────────────────────────────────────────────────────────
function showResult() {
  const el = document.getElementById('diceResultBox');
  if (!el) return;
  el.style.display = 'flex';
  if (diceMode === 'batalha') {
    const [r1, r2] = rollResults;
    const atk = Math.max(r1, r2), def = Math.min(r1, r2);
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
  } else {
    const r = rollResults[0];
    el.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:3rem;font-family:Georgia,serif;font-weight:bold;color:var(--gold);line-height:1">${r}</div>
        <div style="font-size:0.65rem;letter-spacing:.08em;color:var(--text3);font-family:sans-serif;margin-top:3px">🗡 CAPANGA</div>
      </div>`;
  }
}

// ── API global ────────────────────────────────────────────────────────────────
window.abrirDiceDrawer = function() {
  const drawer  = document.getElementById('diceDrawer');
  const overlay = document.getElementById('diceOverlay');
  if (!drawer) return;
  drawer.classList.add('open');
  overlay?.classList.add('open');
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
  const count = diceMode === 'batalha' ? 2 : 1;
  rollResults = Array.from({ length: count }, () =>
    ROOT_FACES[Math.floor(Math.random() * ROOT_FACES.length)]
  );
  targetQuats = rollResults.map(v =>
    new THREE.Quaternion().setFromEuler(getFaceUpEuler(v))
  );
  rollT = 0; pulsed = false; rolling = true;
  landingStarted = false; landQuatStarts = [];
  showingResult = false;
  const el = document.getElementById('diceResultBox');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
};

window.setDiceMode = function(mode) {
  if (mode === diceMode) return;
  if (rolling) { rolling = false; rollT = 0; landingStarted = false; showingResult = false; }
  diceMode = mode;
  document.getElementById('modeBatalha')?.classList.toggle('active', mode === 'batalha');
  document.getElementById('modeCapanga')?.classList.toggle('active', mode === 'capanga');
  const title = document.getElementById('diceDrawerTitle');
  if (title) title.textContent = mode === 'batalha' ? '⚔ Dados de Batalha' : '🗡 Dado de Capanga';
  const btn = document.getElementById('btnRolarDados');
  if (btn) btn.textContent = mode === 'batalha' ? '⚔ Rolar' : '🗡 Rolar';
  const desc = document.getElementById('diceDesc');
  if (desc) desc.innerHTML = mode === 'batalha'
    ? '<strong style="color:var(--text2)">Dado de Root:</strong> 0 · 0 · 1 · 1 · 2 · 3<br>Atacante = maior valor · Defensor = menor valor'
    : '<strong style="color:var(--text2)">Dado de Root:</strong> 0 · 0 · 1 · 1 · 2 · 3';
  const el = document.getElementById('diceResultBox');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  if (ready) setupDice();
};

window.setColorScheme = function(scheme) {
  if (scheme === colorScheme) return;
  colorScheme = scheme;
  document.getElementById('colorWhite')?.classList.toggle('active', scheme === 'white');
  document.getElementById('colorBlack')?.classList.toggle('active', scheme === 'black');
  if (ready) rebuildDiceMaterials();
};
