// Liga: resultado, switchTab, mapa-only

// ===================== LIGA =====================

const LIGA_FACTIONS = [
  { id: 'marquise',  name: 'Marqueses' },
  { id: 'eyrie',     name: 'Dinastia das Rapinas' },
  { id: 'alliance',  name: 'Aliança da Floresta' },
  { id: 'vagabond',  name: 'Malandro' },
  { id: 'vagabond2', name: 'Malandro 2' },
  { id: 'lizard',    name: 'Lagartos Cultistas' },
  { id: 'riverfolk', name: 'Compania Ribeirinha' },
  { id: 'duchy',     name: 'Ducado Subterrâneo' },
  { id: 'corvid',    name: 'Conspiração Corvídea' },
  { id: 'hundreds',  name: 'Senhor das Centenas' },
  { id: 'keepers',   name: 'Guardiões de Ferro' },
];

const VAGABOND_TYPES = [
  'Andarilho','Árbitro','Aventureiro','Funileiro','Ladrão',
  'Patife','Ronin','Saqueador','Vagabundo',
];

function switchTab(tab, btn) {
  document.querySelectorAll('.liga-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.liga-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  if (tab === 'liga') initLiga();
  if (tab === 'mapa') initMapaOnly();
}

// ── Mapa Only state ──
let mapaOnlySelected = new Set(['autumn']);
let mapaOnlyClearing = false;

function initMapaOnly() {
  renderMapaOnlyGrid();
}

function renderMapaOnlyGrid() {
  const grid = document.getElementById('mapaOnlyGrid');
  if (!grid) return;
  grid.innerHTML = '';
  MAPS.forEach(map => {
    const card = document.createElement('label');
    card.className = 'map-card' + (mapaOnlySelected.has(map.id) ? ' selected' : '');
    card.innerHTML = `
      <input type="checkbox" ${mapaOnlySelected.has(map.id)?'checked':''} style="accent-color:var(--gold)">
      <div class="map-icon">${map.icon}</div>
      <div class="map-name">${map.name}</div>
      <div class="map-desc">${map.desc}</div>`;
    const cb = card.querySelector('input');
    cb.onchange = () => {
      if (cb.checked) mapaOnlySelected.add(map.id);
      else if (mapaOnlySelected.size > 1) mapaOnlySelected.delete(map.id);
      else { cb.checked = true; return; }
      card.classList.toggle('selected', mapaOnlySelected.has(map.id));
      document.getElementById('mapaOnlySortNote').style.display = mapaOnlySelected.size > 1 ? 'block' : 'none';
    };
    grid.appendChild(card);
  });
}

function toggleMapaOnlyClearing(checked) {
  mapaOnlyClearing = checked;
  document.getElementById('mapaOnlyClearingRow').classList.toggle('active', checked);
  document.getElementById('mapaOnlyClearingOptions').style.display = checked ? 'block' : 'none';
}

function sortearMapaOnly() {
  const mapArr = MAPS.filter(m => mapaOnlySelected.has(m.id));
  const chosenMap = mapArr.length === 1 ? mapArr[0] : mapArr[Math.floor(Math.random()*mapArr.length)];
  const wasDrawn = mapArr.length > 1;

  let clearingResult = null;
  if (mapaOnlyClearing) {
    const keepCorners = document.getElementById('mapaOnlyCornerToggle').checked;
    clearingResult = drawClearings(chosenMap, keepCorners);
  }

  // Render
  document.getElementById('resultMapaOnlySubtitle').textContent =
    (wasDrawn ? 'Mapa sorteado: ' : 'Mapa: ') + chosenMap.name;

  // Map card
  const mapDiv = document.getElementById('resultMapaOnlyMap');
  mapDiv.innerHTML = '';
  const mapCard = document.createElement('div');
  mapCard.className = 'map-result-card';
  mapCard.innerHTML = `
    <div class="map-result-label">${wasDrawn ? 'Mapa Sorteado' : 'Mapa'}</div>
    <div class="map-result-icon">${chosenMap.icon}</div>
    <div class="map-result-name">${chosenMap.name}</div>
    <div class="map-result-desc">${chosenMap.desc}</div>`;
  mapDiv.appendChild(mapCard);

  // Clearings board
  const clearDiv = document.getElementById('resultMapaOnlyClearing');
  clearDiv.innerHTML = '';
  if (clearingResult) {
    const boardWrap = document.createElement('div');
    boardWrap.className = 'board-wrapper';
    boardWrap.innerHTML = `
      <div class="board-title">Naipes das Clareiras — ${chosenMap.name}</div>
      <div id="boardSvgWrapOnly" style="position:relative;width:100%;"></div>
      <div class="clearing-legend">
        <div class="legend-item"><div class="legend-dot legend-fox"></div> 🦊 Raposa (vermelho)</div>
        <div class="legend-item"><div class="legend-dot legend-mouse"></div> 🐭 Rato (laranja)</div>
        <div class="legend-item"><div class="legend-dot legend-rabbit"></div> 🐇 Coelho (amarelo)</div>
      </div>`;
    clearDiv.appendChild(boardWrap);
    renderBoardSVG('boardSvgWrapOnly', clearingResult, chosenMap);
  }

  sbIncrement('mapa');
  document.getElementById('resultMapaOnly').style.display = 'block';
  document.getElementById('resultMapaOnly').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── WhatsApp share ──
function compartilharWhatsApp() {
  const text = document.getElementById('ligaResultText').textContent;
  const url = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

let ligaNumPlayers = 4;

function initLiga() {
  // Set today's date
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  const el = document.getElementById('ligaData');
  if (el && !el.value) el.value = yyyy+'-'+mm+'-'+dd;
  renderLigaPlayers();
}

function renderLigaPlayers() {
  const wrap = document.getElementById('ligaPlayersWrap');
  wrap.innerHTML = '';

  // Num players selector
  const numRow = document.createElement('div');
  numRow.className = 'section';
  numRow.innerHTML = '<div class="section-title">Número de jogadores</div><div class="player-count-row" id="ligaCountBtns"></div>';
  wrap.appendChild(numRow);

  const countRow = numRow.querySelector('#ligaCountBtns');
  [3,4,5,6].forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'count-btn' + (n === ligaNumPlayers ? ' active' : '');
    btn.textContent = n;
    btn.onclick = () => { ligaNumPlayers = n; renderLigaPlayers(); };
    countRow.appendChild(btn);
  });

  // Player cards
  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = '<div class="section-title">Jogadores e Resultados</div>';

  for (let i = 0; i < ligaNumPlayers; i++) {
    const isFirst = i === 0;
    const card = document.createElement('div');
    card.className = 'liga-player-card';
    card.id = 'ligaPlayer_' + i;

    const facOptions = '<option value="">— Selecione a facção —</option>' + LIGA_FACTIONS.map(f =>
      `<option value="${f.id}">${f.name}</option>`
    ).join('');
    // Will be filtered after all cards are rendered

    const vagOptions = VAGABOND_TYPES.map(v =>
      `<option value="${v}">${v}</option>`
    ).join('');

    card.innerHTML = `
      <div class="liga-player-header">Jogador ${i+1}</div>
      <div class="liga-field-row">
        <div class="liga-field"><label>Nome</label>
          <input type="text" id="ligaName_${i}" placeholder="Nome do jogador">
        </div>
        <div class="liga-field"><label>Facção</label>
          <select id="ligaFac_${i}" onchange="onFacChange(${i});updateFacSelects()">
            ${facOptions}
          </select>
        </div>
      </div>
      <div class="liga-vagabond-sub" id="ligaVagSub_${i}">
        <div class="liga-field" style="max-width:220px">
          <label>Tipo de Malandro</label>
          <select id="ligaVagType_${i}">${vagOptions}</select>
        </div>
      </div>
      <div class="liga-field-row" style="margin-top:8px">
        <div class="liga-field"><label>Pontuação</label>
          <input type="number" id="ligaScore_${i}" min="0" max="99" placeholder="0">
        </div>
        <div class="liga-field" style="justify-content:flex-end;padding-top:18px">
          <div class="liga-checks">
            <label class="liga-check"><input type="checkbox" id="ligaIniciante_${i}"> Iniciante</label>
            <label class="liga-check"><input type="checkbox" id="ligaVitDom_${i}" onchange="onVitDomChange(${i}, this)"> Vitória por domínio</label>
            <label class="liga-check"><input type="checkbox" id="ligaDerDom_${i}" onchange="onDerDomChange(${i}, this)"> Derrota por domínio</label>
          </div>
        </div>
      </div>
    `;
    section.appendChild(card);
  }
  wrap.appendChild(section);
  updateFacSelects();
}

function updateFacSelects() {
  const chosen = [];
  for (let i = 0; i < ligaNumPlayers; i++) {
    const sel = document.getElementById('ligaFac_' + i);
    if (sel) chosen.push(sel.value);
  }
  // Malandro 2 só disponível se Malandro 1 estiver escolhido por alguém
  const vagabondChosen = chosen.includes('vagabond');

  for (let i = 0; i < ligaNumPlayers; i++) {
    const sel = document.getElementById('ligaFac_' + i);
    if (!sel) continue;
    const current = sel.value;
    const otherChosen = chosen.filter((v, idx) => idx !== i);
    Array.from(sel.options).forEach(opt => {
      const takenByOther = otherChosen.includes(opt.value) && opt.value !== current;
      // vagabond2 só disponível se vagabond estiver escolhido (por outro jogador ou por este)
      const v2blocked = opt.value === 'vagabond2' && !vagabondChosen && current !== 'vagabond2';
      opt.disabled = takenByOther || v2blocked;
      opt.style.display = opt.disabled ? 'none' : '';
    });
    // Se o jogador atual tinha vagabond2 e vagabond foi removido, resetar
    if (current === 'vagabond2' && !vagabondChosen) {
      sel.value = '';
      onFacChange(i);
    }
  }
}


function updateVagSelects() {
  // Find all vagabond selects that are visible
  const vagSelects = [];
  for (let i = 0; i < ligaNumPlayers; i++) {
    const sub = document.getElementById('ligaVagSub_' + i);
    const sel = document.getElementById('ligaVagType_' + i);
    if (sub && sel && sub.style.display !== 'none') {
      vagSelects.push({ i, sel, val: sel.value });
    }
  }
  // For each vagabond select, disable options chosen by others
  vagSelects.forEach(({ i, sel, val }) => {
    const otherChosen = vagSelects
      .filter(v => v.i !== i)
      .map(v => v.val);
    Array.from(sel.options).forEach(opt => {
      opt.disabled = otherChosen.includes(opt.value) && opt.value !== val;
      opt.style.display = opt.disabled ? 'none' : '';
    });
  });
}

function onFacChange(i) {
  const fac = document.getElementById('ligaFac_' + i).value;
  const sub = document.getElementById('ligaVagSub_' + i);
  sub.style.display = (fac === 'vagabond' || fac === 'vagabond2') ? 'block' : 'none';
  updateVagSelects();
}

function onVitDomChange(i, cb) {
  if (cb.checked) {
    const der = document.getElementById('ligaDerDom_' + i);
    if (der) der.checked = false;
  }
}

function onDerDomChange(i, cb) {
  if (cb.checked) {
    const vit = document.getElementById('ligaVitDom_' + i);
    if (vit) vit.checked = false;
  }
}

function gerarResultadoLiga() {
  const local = document.getElementById('ligaLocal').value.trim();
  const dataVal = document.getElementById('ligaData').value;

  // Validation
  const erros = [];
  if (!local) erros.push('• Local da partida não preenchido');

  // Collect players with validation
  const players = [];
  for (let i = 0; i < ligaNumPlayers; i++) {
    const name  = document.getElementById('ligaName_' + i).value.trim();
    const facId = document.getElementById('ligaFac_' + i).value;
    const scoreEl = document.getElementById('ligaScore_' + i);
    const scoreVal = scoreEl ? scoreEl.value.trim() : '';
    const vitDom = document.getElementById('ligaVitDom_' + i)?.checked;
    const derDom = document.getElementById('ligaDerDom_' + i)?.checked;

    if (!name) erros.push(`• Jogador ${i+1}: nome não preenchido`);
    if (!facId) erros.push(`• Jogador ${i+1}: facção não selecionada`);
    if (!vitDom && !derDom && scoreVal === '') erros.push(`• Jogador ${i+1}: pontuação não preenchida`);
  }

  if (erros.length > 0) {
    const box = document.getElementById('ligaResultBox');
    box.style.display = 'block';
    document.getElementById('btnCopiar').style.display = 'none';
    document.getElementById('ligaResultText').innerHTML =
      '<span style="color:#f09080;font-family:sans-serif;font-size:0.88rem">Preencha os campos obrigatórios:\n\n' + erros.join('\n') + '</span>';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  sbIncrement('liga');
  document.getElementById('btnCopiar').style.display = '';

  // Format date dd/mm
  let dataStr = '';
  if (dataVal) {
    const parts = dataVal.split('-');
    dataStr = parts[2] + '/' + parts[1];
  }

  const mapa = document.getElementById('ligaMapa').value;
  let header = local + ' ' + dataStr;
  if (mapa) header += ' | Mapa ' + mapa;

  for (let i = 0; i < ligaNumPlayers; i++) {
    const name  = document.getElementById('ligaName_' + i).value.trim();
    const facId = document.getElementById('ligaFac_' + i).value;
    const scoreEl = document.getElementById('ligaScore_' + i);
    const score = scoreEl ? parseInt(scoreEl.value) || 0 : 0;
    const iniciante = document.getElementById('ligaIniciante_' + i)?.checked || false;
    const vitDom = document.getElementById('ligaVitDom_' + i)?.checked;
    const derDom = document.getElementById('ligaDerDom_' + i)?.checked;

    let facName = LIGA_FACTIONS.find(f => f.id === facId)?.name || facId;
    if (facId === 'vagabond' || facId === 'vagabond2') {
      const vtype = document.getElementById('ligaVagType_' + i)?.value;
      if (vtype) facName = 'Malandro (' + vtype + ')';
    }

    players.push({ name, facName, score, iniciante, vitDom, derDom, derDomFlag: derDom });
  }

  // Sort: derrota por domínio goes last; otherwise by score desc, vitória por domínio first in ties
  const normal = players.filter(p => !p.derDomFlag);
  const derDoms = players.filter(p => p.derDomFlag);

  normal.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.vitDom && !b.vitDom) return -1;
    if (b.vitDom && !a.vitDom) return 1;
    return 0;
  });

  const sorted = [...normal, ...derDoms];

  // Build text
  const lines = [header];
  sorted.forEach(p => {
    let line = p.name;
    if (p.iniciante) line += ' (Iniciante)';
    line += ' - ' + p.facName;
    if (p.vitDom) line += ' Vitória por Domínio';
    else if (p.derDomFlag) line += ' Derrota por Domínio';
    else line += ' ' + p.score;
    lines.push(line);
  });

  const result = lines.join('\n');
  document.getElementById('ligaResultText').textContent = result;
  document.getElementById('ligaResultBox').style.display = 'block';
  document.getElementById('btnCopiar').textContent = '📋 Copiar';
  document.getElementById('btnCopiar').className = 'btn-copiar';
  document.getElementById('ligaResultBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function copiarResultado() {
  const text = document.getElementById('ligaResultText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btnCopiar');
    btn.textContent = '✓ Copiado!';
    btn.className = 'btn-copiar copied';
    setTimeout(() => {
      btn.textContent = '📋 Copiar';
      btn.className = 'btn-copiar';
    }, 2000);
  }).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    const btn = document.getElementById('btnCopiar');
    btn.textContent = '✓ Copiado!';
    btn.className = 'btn-copiar copied';
    setTimeout(() => { btn.textContent = '📋 Copiar'; btn.className = 'btn-copiar'; }, 2000);
  });
}

// Inicialização — executada após todos os scripts carregarem
init();
sbLoadCounters();