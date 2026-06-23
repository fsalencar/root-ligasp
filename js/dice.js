// Dados Root — Three.js ES Module
const ROOT_FACES = [0, 0, 1, 1, 2, 3];

// Dado de batalha: dodecaedro 12 faces com números
const FACE_VALUES_12 = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3];

// Dado de capanga: cubo 6 faces com estrelas
const CAPANGA_FACES = [
  {y:1,o:1},{y:1,o:1},{y:1,o:1},
  {y:2,o:1},{y:2,o:1},
  {y:2,o:2},
];
const CAPANGA_BODY = '#2a1005';
const STAR_Y = '#e8a030';
const STAR_O = '#cc3300';

// Dado de turba: cubo 6 faces com animais (2 raposas, 2 coelhos, 2 ratos)
const TURBA_FACES_ORDER = ['fox','fox','rabbit','rabbit','mouse','mouse'];
const TURBA_ANIMAL_COLOR = { fox:'#cc2200', rabbit:'#f0d000', mouse:'#e07030' };
const TURBA_ANIMAL_NAME  = { fox:'Raposa',  rabbit:'Coelho',  mouse:'Rato'   };
const TURBA_BODY = { black:'#111111', green:'#1e7a20' };

const BOX_NORMALS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

let THREE = null;
let renderer = null, scene = null, camera = null;
let dice = [];
let animFrame = null;
let rolling = false, rollT = 0, rollResults = [], pulsed = false;
let landingStarted = false, landQuatStarts = [], targetQuats = [];
let showingResult = false;
let lastTs = 0, ready = false;
let diceMode    = 'batalha';
let colorScheme = 'white';
let turbaScheme = 'black';
let dodecaGeo = null;
let dodecaFaceNormals = [];

const ease    = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
const easeOut = t => 1 - Math.pow(1-t, 3);
const LAND_T  = 0.60;
const SCHEMES = {
  white: { body:'#f5f5f0', num:'#111111' },
  black: { body:'#1a1209', num:'#c8a050' },
};

// ── Three.js lazy ─────────────────────────────────────────────────────────────
async function ensureThree() {
  if (THREE) return true;
  try { THREE = await import('three'); return true; }
  catch(e) { const el=document.getElementById('diceStatus'); if(el) el.textContent='Erro Three.js: '+e.message; return false; }
}

// ── Textura: número (batalha) ─────────────────────────────────────────────────
function makeFaceTex(value, bodyColor, numColor) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bodyColor; ctx.fillRect(0,0,256,256);
  ctx.fillStyle = numColor; ctx.font='bold 158px Georgia,serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(String(value), 128, 132);
  return new THREE.CanvasTexture(c);
}

// ── Textura: estrelas (capanga) ───────────────────────────────────────────────
const STAR_POS = {
  2: [[84,84],[172,172]],
  3: [[172,80],[128,128],[84,176]],
  4: [[80,80],[176,80],[80,176],[176,176]],
};
function drawStar4(ctx, x, y, outer, inner, color) {
  ctx.fillStyle = color; ctx.beginPath();
  for(let i=0;i<8;i++){
    const a=(i*Math.PI/4)-Math.PI/2, r=i%2===0?outer:inner;
    i===0?ctx.moveTo(x+r*Math.cos(a),y+r*Math.sin(a)):ctx.lineTo(x+r*Math.cos(a),y+r*Math.sin(a));
  }
  ctx.closePath(); ctx.fill();
}
function makeCapangaFaceTex(yc, oc) {
  const c = document.createElement('canvas'); c.width=c.height=256;
  const ctx = c.getContext('2d');
  ctx.fillStyle=CAPANGA_BODY; ctx.fillRect(0,0,256,256);
  const pos=STAR_POS[yc+oc]||[[128,128]];
  pos.slice(0,yc).forEach(([x,y])=>drawStar4(ctx,x,y,40,13,STAR_Y));
  pos.slice(yc).forEach(([x,y])=>drawStar4(ctx,x,y,31,10,STAR_O));
  return new THREE.CanvasTexture(c);
}

// ── Desenho de animais (turba) ────────────────────────────────────────────────
function drawMouse(ctx, col) {
  const o='#1a0a00';
  ctx.lineJoin='round'; ctx.lineCap='round';
  // orelhas
  ctx.fillStyle=col; ctx.strokeStyle=o; ctx.lineWidth=6;
  ctx.beginPath(); ctx.arc(84,62,30,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(172,62,30,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // cabeça
  ctx.beginPath(); ctx.arc(128,118,56,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // olhos brancos
  ctx.fillStyle='white'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.ellipse(108,122,13,17,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(148,122,13,17,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // braços cruzados (X) embaixo
  ctx.strokeStyle=o; ctx.lineWidth=8;
  ctx.beginPath();
  ctx.moveTo(76,182); ctx.lineTo(102,200); ctx.moveTo(102,182); ctx.lineTo(76,200);
  ctx.moveTo(154,182); ctx.lineTo(180,200); ctx.moveTo(180,182); ctx.lineTo(154,200);
  ctx.stroke();
}

function drawRabbit(ctx, col) {
  const o='#1a0a00';
  ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.fillStyle=col; ctx.strokeStyle=o; ctx.lineWidth=6;
  // orelha esquerda
  ctx.beginPath(); ctx.ellipse(102,70,20,56,-0.1,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // orelha direita
  ctx.beginPath(); ctx.ellipse(154,70,20,56,0.1,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // cabeça
  ctx.beginPath(); ctx.arc(128,150,52,0,Math.PI*2); ctx.fill(); ctx.stroke();
  // olhos
  ctx.fillStyle='white'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.ellipse(110,153,12,16,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(146,153,12,16,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
}

function drawFox(ctx, col) {
  const o='#1a0a00';
  ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.fillStyle=col; ctx.strokeStyle=o; ctx.lineWidth=6;
  // silhueta da raposa: coroa com 3 pontas
  ctx.beginPath();
  ctx.moveTo(128,215);
  ctx.bezierCurveTo(100,216,72,202,70,178);
  ctx.bezierCurveTo(68,158,72,140,76,124);
  ctx.bezierCurveTo(72,110,70,94,76,80);
  // orelha esquerda
  ctx.bezierCurveTo(76,62,84,48,96,46);
  ctx.bezierCurveTo(108,44,114,60,116,72);
  // vale esquerdo
  ctx.bezierCurveTo(118,80,120,82,122,76);
  // ponta central
  ctx.bezierCurveTo(124,62,126,40,128,38);
  ctx.bezierCurveTo(130,40,132,62,134,76);
  // vale direito
  ctx.bezierCurveTo(136,82,138,80,140,72);
  // orelha direita
  ctx.bezierCurveTo(142,60,148,44,160,46);
  ctx.bezierCurveTo(172,48,180,62,180,80);
  ctx.bezierCurveTo(186,94,184,110,180,124);
  ctx.bezierCurveTo(184,140,188,158,186,178);
  ctx.bezierCurveTo(184,202,156,216,128,215);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // olhos brancos triangulares (inclinados para o centro)
  ctx.fillStyle='white'; ctx.strokeStyle='transparent';
  ctx.beginPath(); ctx.moveTo(90,148); ctx.lineTo(114,136); ctx.lineTo(112,154); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(166,148); ctx.lineTo(142,136); ctx.lineTo(144,154); ctx.closePath(); ctx.fill();
}

function makeTurbaFaceTex(animal, bodyColor) {
  const c = document.createElement('canvas'); c.width=c.height=256;
  const ctx = c.getContext('2d');
  ctx.fillStyle=bodyColor; ctx.fillRect(0,0,256,256);
  ctx.fillStyle=TURBA_ANIMAL_COLOR[animal];
  if(animal==='mouse')  drawMouse(ctx, TURBA_ANIMAL_COLOR.mouse);
  if(animal==='rabbit') drawRabbit(ctx, TURBA_ANIMAL_COLOR.rabbit);
  if(animal==='fox')    drawFox(ctx, TURBA_ANIMAL_COLOR.fox);
  return new THREE.CanvasTexture(c);
}

// ── Geometria dodecaedro ──────────────────────────────────────────────────────
function buildDodecaGeo() {
  const base=new THREE.DodecahedronGeometry(0.90,0), geo=base.toNonIndexed(); base.dispose();
  const pos=geo.attributes.position, uvArr=new Float32Array(pos.count*2);
  dodecaFaceNormals=[];
  for(let f=0;f<12;f++){
    const ofs=f*9; let cx=0,cy=0,cz=0;
    for(let v=0;v<9;v++){cx+=pos.getX(ofs+v);cy+=pos.getY(ofs+v);cz+=pos.getZ(ofs+v);}
    cx/=9;cy/=9;cz/=9;
    const len=Math.sqrt(cx*cx+cy*cy+cz*cz)||1;
    dodecaFaceNormals.push(new THREE.Vector3(cx/len,cy/len,cz/len));
    const nx=cx/len,ny=cy/len,nz=cz/len;
    let tx,ty=0,tz;
    if(Math.abs(ny)<0.9){tx=-nz;tz=nx;}else{tx=1;tz=0;}
    const tl=Math.sqrt(tx*tx+tz*tz)||1; tx/=tl;tz/=tl;
    const bx=ny*tz-nz*ty,by=nz*tx-nx*tz,bz=nx*ty-ny*tx;
    const us=[],vs=[];
    for(let v=0;v<9;v++){
      const dx=pos.getX(ofs+v)-cx,dy=pos.getY(ofs+v)-cy,dz=pos.getZ(ofs+v)-cz;
      us.push(dx*tx+dy*ty+dz*tz); vs.push(dx*bx+dy*by+dz*bz);
    }
    const minU=Math.min(...us),maxU=Math.max(...us),minV=Math.min(...vs),maxV=Math.max(...vs);
    const sc=Math.max(maxU-minU,maxV-minV)||1,midU=(minU+maxU)/2,midV=(minV+maxV)/2;
    for(let v=0;v<9;v++){
      uvArr[(ofs+v)*2]  =(us[v]-midU)/sc*0.88+0.5;
      uvArr[(ofs+v)*2+1]=(vs[v]-midV)/sc*0.88+0.5;
    }
    geo.addGroup(ofs,9,f);
  }
  geo.setAttribute('uv',new THREE.BufferAttribute(uvArr,2));
  geo.computeVertexNormals(); dodecaGeo=geo;
}

// ── Quaternion face-up ────────────────────────────────────────────────────────
function getTargetQuatDodeca(value) {
  const yUp=new THREE.Vector3(0,1,0);
  const cands=FACE_VALUES_12.map((v,i)=>v===value?i:-1).filter(i=>i>=0);
  const fi=cands[Math.floor(Math.random()*cands.length)];
  const q1=new THREE.Quaternion().setFromUnitVectors(dodecaFaceNormals[fi],yUp);
  const q2=new THREE.Quaternion().setFromAxisAngle(yUp,Math.floor(Math.random()*5)*(2*Math.PI/5));
  return q2.multiply(q1);
}
function getTargetQuatBox(faceIdx) {
  const yUp=new THREE.Vector3(0,1,0);
  const fn=new THREE.Vector3(...BOX_NORMALS[faceIdx]);
  const q1=new THREE.Quaternion().setFromUnitVectors(fn,yUp);
  const q2=new THREE.Quaternion().setFromAxisAngle(yUp,Math.floor(Math.random()*4)*Math.PI/2);
  return q2.multiply(q1);
}

// ── Cria dados ────────────────────────────────────────────────────────────────
function makeBattleDie() {
  const {body,num}=SCHEMES[colorScheme];
  const mats=FACE_VALUES_12.map(v=>new THREE.MeshStandardMaterial({map:makeFaceTex(v,body,num),roughness:0.30,metalness:0.05}));
  const mesh=new THREE.Mesh(dodecaGeo,mats);
  mesh.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); return mesh;
}
function makeCapangaDie() {
  const mats=CAPANGA_FACES.map(f=>new THREE.MeshStandardMaterial({map:makeCapangaFaceTex(f.y,f.o),roughness:0.35,metalness:0.08}));
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.3,1.3),mats);
  mesh.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); return mesh;
}
function makeTurbaDie() {
  const body=TURBA_BODY[turbaScheme];
  const mats=TURBA_FACES_ORDER.map(a=>new THREE.MeshStandardMaterial({map:makeTurbaFaceTex(a,body),roughness:0.38,metalness:0.08}));
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.3,1.3),mats);
  mesh.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6); return mesh;
}

// ── Monta dados na cena ───────────────────────────────────────────────────────
function setupDice() {
  dice.forEach(d=>{
    scene.remove(d);
    if(Array.isArray(d.material)) d.material.forEach(m=>{m.map?.dispose();m.dispose();});
    if(d.geometry&&d.geometry!==dodecaGeo) d.geometry.dispose();
  });
  dice=[];
  if(diceMode==='batalha'){
    const d1=makeBattleDie(); d1.position.set(-1.65,0,0); scene.add(d1); dice.push(d1);
    const d2=makeBattleDie(); d2.position.set( 1.65,0,0); scene.add(d2); dice.push(d2);
  } else if(diceMode==='capanga'){
    const d1=makeCapangaDie(); d1.position.set(0,0,0); scene.add(d1); dice.push(d1);
  } else {
    const d1=makeTurbaDie(); d1.position.set(0,0,0); scene.add(d1); dice.push(d1);
  }
}

// ── Atualiza cores ────────────────────────────────────────────────────────────
function rebuildDiceMaterials() {
  if(diceMode!=='batalha') return;
  const {body,num}=SCHEMES[colorScheme];
  dice.forEach(die=>FACE_VALUES_12.forEach((v,i)=>{
    die.material[i].map?.dispose(); die.material[i].map=makeFaceTex(v,body,num); die.material[i].needsUpdate=true;
  }));
}
function rebuildTurbaMaterials() {
  if(diceMode!=='turba') return;
  const body=TURBA_BODY[turbaScheme];
  dice.forEach(die=>TURBA_FACES_ORDER.forEach((a,i)=>{
    die.material[i].map?.dispose(); die.material[i].map=makeTurbaFaceTex(a,body); die.material[i].needsUpdate=true;
  }));
}

// ── Init Three.js ─────────────────────────────────────────────────────────────
async function initScene() {
  if(!await ensureThree()) return;
  const canvas=document.getElementById('diceCanvas'); if(!canvas) return;
  const W=canvas.parentElement?.clientWidth||300, H=240;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setSize(W,H); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor(0,0);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(48,W/H,0.1,100);
  camera.position.set(0,2.2,5.2); camera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0xfff8e7,0.85));
  const sun=new THREE.DirectionalLight(0xffffff,1.6); sun.position.set(4,10,6); scene.add(sun);
  const fill=new THREE.DirectionalLight(0xc8a050,0.4); fill.position.set(-5,-3,-6); scene.add(fill);
  const rim=new THREE.DirectionalLight(0x6099d0,0.2); rim.position.set(0,-6,3); scene.add(rim);
  buildDodecaGeo(); setupDice();
  ready=true; requestAnimationFrame(loop);
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop(ts) {
  animFrame=requestAnimationFrame(loop);
  const dt=Math.min((ts-lastTs)/1000,0.05); lastTs=ts;

  if(rolling){
    rollT=Math.min(rollT+dt/2.4,1); const t=rollT;

    if(diceMode==='batalha'&&dice.length===2){
      let x1,x2;
      if(t<0.40){const p=ease(t/0.40);x1=-1.65+1.3*p;x2=1.65-1.3*p;}
      else if(t<0.52){x1=-0.35;x2=0.35;if(!pulsed){pulsed=true;dice.forEach(d=>d.scale.setScalar(1.2));setTimeout(()=>{if(dice.length)dice.forEach(d=>d.scale.setScalar(1));},130);}}
      else if(t<LAND_T){const p=easeOut((t-0.52)/(LAND_T-0.52));x1=-0.35-1.3*p;x2=0.35+1.3*p;}
      else{x1=-1.65;x2=1.65;}
      dice[0].position.x=x1; dice[1].position.x=x2;
    }
    if(diceMode!=='batalha'&&dice.length===1){
      dice[0].position.y=t<0.35?Math.sin(t*Math.PI/0.35)*0.9:0;
    }

    if(t>=LAND_T&&!landingStarted){landingStarted=true;landQuatStarts=dice.map(d=>d.quaternion.clone());}
    if(!landingStarted){
      const sp=10;
      if(dice[0]){dice[0].rotation.x+=dt*sp*1.2;dice[0].rotation.y+=dt*sp*0.75;}
      if(dice[1]){dice[1].rotation.x+=dt*sp*0.85;dice[1].rotation.y+=dt*sp*1.35;dice[1].rotation.z+=dt*sp*0.4;}
    } else {
      const p=easeOut((t-LAND_T)/(1-LAND_T));
      dice.forEach((d,i)=>{if(targetQuats[i])d.quaternion.slerpQuaternions(landQuatStarts[i],targetQuats[i],p);});
    }

    if(rollT>=1){
      rolling=false; showingResult=true;
      dice.forEach((d,i)=>{if(targetQuats[i])d.quaternion.copy(targetQuats[i]);});
      if(diceMode==='batalha'&&dice.length===2){dice[0].position.x=-1.65;dice[1].position.x=1.65;}
      if(diceMode!=='batalha'&&dice.length===1){dice[0].position.y=0;}
      showResult();
    }
  } else if(!showingResult){
    if(dice[0]){dice[0].rotation.y+=dt*0.32;dice[0].rotation.x+=dt*0.09;}
    if(dice[1]){dice[1].rotation.y-=dt*0.26;dice[1].rotation.x+=dt*0.12;}
  }
  renderer?.render(scene,camera);
}

// ── Resultado ─────────────────────────────────────────────────────────────────
function showResult() {
  const el=document.getElementById('diceResultBox'); if(!el) return;
  el.style.display='flex';
  if(diceMode==='batalha'){
    const [r1,r2]=rollResults, atk=Math.max(r1,r2), def=Math.min(r1,r2);
    el.innerHTML=`
      <div style="text-align:center;"><div style="font-size:2.4rem;font-family:Georgia,serif;font-weight:bold;color:#f0801a;line-height:1">${atk}</div><div style="font-size:0.65rem;letter-spacing:.08em;color:var(--text3);font-family:sans-serif;margin-top:3px">⚔ ATACANTE</div></div>
      <div style="font-size:1.1rem;color:var(--text3);align-self:center">vs</div>
      <div style="text-align:center;"><div style="font-size:2.4rem;font-family:Georgia,serif;font-weight:bold;color:#4090d0;line-height:1">${def}</div><div style="font-size:0.65rem;letter-spacing:.08em;color:var(--text3);font-family:sans-serif;margin-top:3px">🛡 DEFENSOR</div></div>`;
  } else if(diceMode==='capanga'){
    const f=CAPANGA_FACES[rollResults[0]];
    const yS=`<span style="color:${STAR_Y};font-size:2.2rem">✦</span>`;
    const oS=`<span style="color:${STAR_O};font-size:2.2rem">✦</span>`;
    el.innerHTML=`<div style="text-align:center;"><div style="letter-spacing:5px;line-height:1.2">${yS.repeat(f.y)}${oS.repeat(f.o)}</div><div style="font-size:0.65rem;color:var(--text3);font-family:sans-serif;margin-top:6px"><span style="color:${STAR_Y}">${f.y} amarela${f.y>1?'s':''}</span>&nbsp;·&nbsp;<span style="color:${STAR_O}">${f.o} laranja${f.o>1?'s':''}</span></div></div>`;
  } else {
    const animal=TURBA_FACES_ORDER[rollResults[0]];
    const col=TURBA_ANIMAL_COLOR[animal], name=TURBA_ANIMAL_NAME[animal];
    el.innerHTML=`<div style="text-align:center;"><div style="font-size:2.6rem;font-weight:bold;color:${col};font-family:Georgia,serif;line-height:1">${name}</div><div style="font-size:0.65rem;letter-spacing:.08em;color:var(--text3);font-family:sans-serif;margin-top:4px">🐾 TURBA</div></div>`;
  }
}

// ── API ───────────────────────────────────────────────────────────────────────
window.abrirDiceDrawer = function() {
  const drawer=document.getElementById('diceDrawer'), overlay=document.getElementById('diceOverlay');
  if(!drawer) return;
  drawer.classList.add('open'); overlay?.classList.add('open');
  document.body.style.overflow='hidden';
  if(!ready) initScene(); else if(!animFrame) requestAnimationFrame(loop);
};

window.fecharDiceDrawer = function() {
  document.getElementById('diceDrawer')?.classList.remove('open');
  document.getElementById('diceOverlay')?.classList.remove('open');
  document.body.style.overflow='';
  if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}
};

window.rolarDados = function() {
  if(rolling||!ready) return;
  if(diceMode==='batalha'){
    rollResults=[ROOT_FACES[Math.floor(Math.random()*ROOT_FACES.length)],ROOT_FACES[Math.floor(Math.random()*ROOT_FACES.length)]];
    targetQuats=rollResults.map(v=>getTargetQuatDodeca(v));
  } else if(diceMode==='capanga'){
    const fi=Math.floor(Math.random()*CAPANGA_FACES.length);
    rollResults=[fi]; targetQuats=[getTargetQuatBox(fi)];
  } else {
    const fi=Math.floor(Math.random()*TURBA_FACES_ORDER.length);
    rollResults=[fi]; targetQuats=[getTargetQuatBox(fi)];
  }
  rollT=0;pulsed=false;rolling=true;landingStarted=false;landQuatStarts=[];
  showingResult=false;
  const el=document.getElementById('diceResultBox'); if(el){el.style.display='none';el.innerHTML='';}
};

window.setDiceMode = function(mode) {
  if(mode===diceMode) return;
  if(rolling){rolling=false;rollT=0;landingStarted=false;showingResult=false;}
  diceMode=mode;
  document.getElementById('modeBatalha')?.classList.toggle('active',mode==='batalha');
  document.getElementById('modeCapanga')?.classList.toggle('active',mode==='capanga');
  document.getElementById('modeTurba')?.classList.toggle('active',mode==='turba');
  const title=document.getElementById('diceDrawerTitle');
  if(title) title.textContent={batalha:'⚔ Dados de Batalha',capanga:'🗡 Dado de Capanga',turba:'🐾 Dado de Turba'}[mode];
  const btn=document.getElementById('btnRolarDados');
  if(btn) btn.textContent={batalha:'⚔ Rolar',capanga:'🗡 Rolar',turba:'🐾 Rolar'}[mode];
  const desc=document.getElementById('diceDesc');
  if(desc) desc.innerHTML={
    batalha:'<strong style="color:var(--text2)">Dado de Root:</strong> 0 · 0 · 1 · 1 · 2 · 3<br>Atacante = maior valor · Defensor = menor valor',
    capanga:`<strong style="color:var(--text2)">Capanga:</strong> 3× <span style="color:${STAR_Y}">✦</span><span style="color:${STAR_O}">✦</span> &nbsp;·&nbsp; 2× <span style="color:${STAR_Y}">✦✦</span><span style="color:${STAR_O}">✦</span> &nbsp;·&nbsp; 1× <span style="color:${STAR_Y}">✦✦</span><span style="color:${STAR_O}">✦✦</span>`,
    turba:`<strong style="color:var(--text2)">Turba:</strong> 2× <span style="color:${TURBA_ANIMAL_COLOR.fox}">Raposa</span> · 2× <span style="color:${TURBA_ANIMAL_COLOR.rabbit}">Coelho</span> · 2× <span style="color:${TURBA_ANIMAL_COLOR.mouse}">Rato</span>`,
  }[mode];
  document.getElementById('diceColorRow').style.display  = mode==='batalha' ? 'flex' : 'none';
  document.getElementById('turbaColorRow').style.display = mode==='turba'   ? 'flex' : 'none';
  const el=document.getElementById('diceResultBox'); if(el){el.style.display='none';el.innerHTML='';}
  showingResult=false;
  if(ready) setupDice();
};

window.setColorScheme = function(scheme) {
  if(scheme===colorScheme) return;
  colorScheme=scheme;
  document.getElementById('colorWhite')?.classList.toggle('active',scheme==='white');
  document.getElementById('colorBlack')?.classList.toggle('active',scheme==='black');
  if(ready) rebuildDiceMaterials();
};

window.setTurbaColor = function(scheme) {
  if(scheme===turbaScheme) return;
  turbaScheme=scheme;
  document.getElementById('turbaDark')?.classList.toggle('active',scheme==='black');
  document.getElementById('turbaGreen')?.classList.toggle('active',scheme==='green');
  if(ready) rebuildTurbaMaterials();
};
