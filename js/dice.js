// Dados Root — Three.js ES Module
// Dodecaedro (12 faces) com textura por face e face-up exata
const ROOT_FACES = [0, 0, 1, 1, 2, 3];

// 12 faces do dodecaedro — distribuição igual ao dado Root (0×4, 1×4, 2×2, 3×2)
const FACE_VALUES_12 = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3];

let THREE = null;
let renderer = null, scene = null, camera = null;
let dice = [];
let animFrame = null;
let rolling = false, rollT = 0, rollResults = [], pulsed = false;
let landingStarted = false, landQuatStarts = [], targetQuats = [];
let showingResult = false;
let lastTs = 0, ready = false;
let diceMode = 'batalha';
let colorScheme = 'white';
let dodecaGeo = null;
let dodecaFaceNormals = [];   // normal de cada face (dir. do centroide)

const ease    = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const LAND_T  = 0.60;

const SCHEMES = {
  white: { body: '#f5f5f0', num: '#111111' },
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

// ── Textura canvas para uma face ──────────────────────────────────────────────
function makeFaceTex(value, bodyColor, numColor) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bodyColor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = numColor;
  ctx.font = 'bold 158px Georgia,serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), 128, 132);
  return new THREE.CanvasTexture(c);
}

// ── Geometria dodecaedro com 12 grupos de material + UV por face ──────────────
function buildDodecaGeo() {
  const base = new THREE.DodecahedronGeometry(0.90, 0);
  const geo  = base.toNonIndexed();
  base.dispose();

  const pos   = geo.attributes.position;
  const nV    = pos.count; // 108
  const uvArr = new Float32Array(nV * 2);
  dodecaFaceNormals = [];

  for (let f = 0; f < 12; f++) {
    const ofs = f * 9;

    // centroide da face
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < 9; v++) {
      cx += pos.getX(ofs + v);
      cy += pos.getY(ofs + v);
      cz += pos.getZ(ofs + v);
    }
    cx /= 9; cy /= 9; cz /= 9;

    // normal = centroide normalizado (dado convexo centralizado na origem)
    const len = Math.sqrt(cx*cx + cy*cy + cz*cz) || 1;
    dodecaFaceNormals.push(new THREE.Vector3(cx/len, cy/len, cz/len));

    // base tangente para projetar UV
    const nx = cx/len, ny = cy/len, nz = cz/len;
    let tx, ty = 0, tz;
    if (Math.abs(ny) < 0.9) { tx = -nz; tz = nx; }
    else                     { tx = 1;   tz = 0;  }
    const tl = Math.sqrt(tx*tx + tz*tz) || 1;
    tx /= tl; tz /= tl;
    const bx = ny*tz - nz*ty;
    const by = nz*tx - nx*tz;
    const bz = nx*ty - ny*tx;

    const us = [], vs = [];
    for (let v = 0; v < 9; v++) {
      const dx = pos.getX(ofs+v) - cx;
      const dy = pos.getY(ofs+v) - cy;
      const dz = pos.getZ(ofs+v) - cz;
      us.push(dx*tx + dy*ty + dz*tz);
      vs.push(dx*bx + dy*by + dz*bz);
    }
    const minU = Math.min(...us), maxU = Math.max(...us);
    const minV = Math.min(...vs), maxV = Math.max(...vs);
    const sc   = Math.max(maxU - minU, maxV - minV) || 1;
    const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;

    for (let v = 0; v < 9; v++) {
      uvArr[(ofs+v)*2]     = (us[v] - midU) / sc * 0.88 + 0.5;
      uvArr[(ofs+v)*2 + 1] = (vs[v] - midV) / sc * 0.88 + 0.5;
    }

    geo.addGroup(ofs, 9, f);
  }

  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  geo.computeVertexNormals();
  dodecaGeo = geo;
}

// ── Quaternion que coloca 'value' com face pra cima (+Y) ──────────────────────
function getTargetQuat(value) {
  const yUp = new THREE.Vector3(0, 1, 0);
  const candidates = FACE_VALUES_12
    .map((v, i) => v === value ? i : -1)
    .filter(i => i >= 0);
  const fi = candidates[Math.floor(Math.random() * candidates.length)];
  const fn = dodecaFaceNormals[fi];
  const q1 = new THREE.Quaternion().setFromUnitVectors(fn, yUp);
  // rotação extra em Y (múltiplos de 72° — simetria do pentágono)
  const rY = Math.floor(Math.random() * 5) * (2 * Math.PI / 5);
  const q2 = new THREE.Quaternion().setFromAxisAngle(yUp, rY);
  return q2.multiply(q1);
}

// ── Cria um dado (mesh com 12 materiais) ──────────────────────────────────────
function makeDie() {
  const { body, num } = SCHEMES[colorScheme];
  const mats = FACE_VALUES_12.map(v =>
    new THREE.MeshStandardMaterial({ map: makeFaceTex(v, body, num), roughness: 0.30, metalness: 0.05 })
  );
  const mesh = new THREE.Mesh(dodecaGeo, mats);
  mesh.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
  return mesh;
}

// ── Monta dados na cena ───────────────────────────────────────────────────────
function setupDice() {
  dice.forEach(d => {
    scene.remove(d);
    if (Array.isArray(d.material)) {
      d.material.forEach(m => { m.map?.dispose(); m.dispose(); });
    }
  });
  dice = [];

  if (diceMode === 'batalha') {
    const d1 = makeDie(); d1.position.set(-1.65, 0, 0); scene.add(d1); dice.push(d1);
    const d2 = makeDie(); d2.position.set( 1.65, 0, 0); scene.add(d2); dice.push(d2);
  } else {
    const d1 = makeDie(); d1.position.set(0, 0, 0); scene.add(d1); dice.push(d1);
  }
}

// ── Atualiza cores ────────────────────────────────────────────────────────────
function rebuildDiceMaterials() {
  const { body, num } = SCHEMES[colorScheme];
  dice.forEach(die => {
    FACE_VALUES_12.forEach((v, i) => {
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
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0, 0);

  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(48, W/H, 0.1, 100);
  // Ligeiramente acima para a face de cima ficar visível após o resultado
  camera.position.set(0, 2.2, 5.2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xfff8e7, 0.85));
  const sun  = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(4, 10, 6); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc8a050, 0.4); fill.position.set(-5,-3,-6); scene.add(fill);
  const rim  = new THREE.DirectionalLight(0x6099d0, 0.2); rim.position.set(0,-6, 3); scene.add(rim);

  buildDodecaGeo();
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

    // animação de posição — apenas no modo batalha
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

    // captura quaternion no início da fase de pouso
    if (t >= LAND_T && !landingStarted) {
      landingStarted = true;
      landQuatStarts = dice.map(d => d.quaternion.clone());
    }

    if (!landingStarted) {
      // giro rápido
      const sp = 10;
      if (dice[0]) { dice[0].rotation.x += dt*sp*1.2; dice[0].rotation.y += dt*sp*0.75; }
      if (dice[1]) { dice[1].rotation.x += dt*sp*0.85; dice[1].rotation.y += dt*sp*1.35; dice[1].rotation.z += dt*sp*0.4; }
    } else {
      // slerp até a face alvo
      const p = easeOut((t - LAND_T) / (1 - LAND_T));
      dice.forEach((d, i) => {
        if (targetQuats[i]) d.quaternion.slerpQuaternions(landQuatStarts[i], targetQuats[i], p);
      });
    }

    if (rollT >= 1) {
      rolling = false;
      showingResult = true;
      dice.forEach((d, i) => { if (targetQuats[i]) d.quaternion.copy(targetQuats[i]); });
      if (diceMode === 'batalha' && dice.length === 2) {
        dice[0].position.x = -1.65; dice[1].position.x = 1.65;
      }
      showResult();
    }

  } else if (!showingResult) {
    if (dice[0]) { dice[0].rotation.y += dt*0.32; dice[0].rotation.x += dt*0.09; }
    if (dice[1]) { dice[1].rotation.y -= dt*0.26; dice[1].rotation.x += dt*0.12; }
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
  targetQuats = rollResults.map(v => getTargetQuat(v));
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
  showingResult = false;
  if (ready) setupDice();
};

window.setColorScheme = function(scheme) {
  if (scheme === colorScheme) return;
  colorScheme = scheme;
  document.getElementById('colorWhite')?.classList.toggle('active', scheme === 'white');
  document.getElementById('colorBlack')?.classList.toggle('active', scheme === 'black');
  if (ready) rebuildDiceMaterials();
};
