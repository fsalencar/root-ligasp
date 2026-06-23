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

const VALID_TABS = ['sorteio', 'partida', 'mapa', 'liga', 'historico', 'aprovacoes'];

// Ativa a aba sem tocar no histórico do browser (restauração e popstate)
function _activateTab(tab, btn) {
  document.querySelectorAll('.liga-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.liga-tab').forEach(b => b.classList.remove('active'));
  const section = document.getElementById('tab-' + tab);
  if (!section) return;
  section.classList.add('active');
  btn.classList.add('active');
  localStorage.setItem('ligaActiveTab', tab);
  if (tab !== 'partida' && typeof stopTimer === 'function') stopTimer();
  if (tab === 'liga') initLiga();
  if (tab === 'mapa') initMapaOnly();
  if (tab === 'partida' && typeof renderPartida === 'function') renderPartida();
  if (tab === 'historico' && typeof carregarHistorico === 'function') carregarHistorico();
  if (tab === 'aprovacoes' && typeof carregarAprovacoes === 'function') carregarAprovacoes();
}

// Chamado pelos botões no HTML — atualiza a URL e ativa a aba
function switchTab(tab, btn) {
  history.pushState({ tab }, '', '#' + tab);
  _activateTab(tab, btn);
}

// Restaura aba a partir do hash da URL ou do localStorage
function restoreTabFromHash() {
  const hash = window.location.hash.replace('#', '').trim();
  const tab = (hash && VALID_TABS.includes(hash)) ? hash
    : (localStorage.getItem('ligaActiveTab') || 'sorteio');
  if (tab === 'sorteio') return;
  const btn = document.querySelector(`.liga-tab[data-tab="${tab}"]`);
  if (btn) _activateTab(tab, btn);
}

// Botões voltar/avançar do browser
window.addEventListener('popstate', () => {
  const hash = window.location.hash.replace('#', '').trim();
  const tab = (hash && VALID_TABS.includes(hash)) ? hash : 'sorteio';
  const btn = document.querySelector(`.liga-tab[data-tab="${tab}"]`);
  if (btn) _activateTab(tab, btn);
});

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

// Estado do envio para a liga
let _ligaDadosAtual      = null;
let _ligaUploadPontuacao = null;
let _ligaUploadJogadores = null;
let _ligaEditando        = null; // { id, dados, nota_embaixador } ao editar revisão

function initLiga() {
  if (_ligaEditando) ligaNumPlayers = _ligaEditando.dados?.jogadores?.length || ligaNumPlayers;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  const todayStr = yyyy+'-'+mm+'-'+dd;
  const el = document.getElementById('ligaData');
  if (el && !el.value && !_ligaEditando) el.value = todayStr;

  renderLigaPlayers();

  if (_ligaEditando) {
    _preencherFormularioEdicao(_ligaEditando.dados, todayStr);
    _mostrarBannerEdicao(_ligaEditando.nota_embaixador);
  } else {
    const banner = document.getElementById('ligaEditBanner');
    if (banner) banner.innerHTML = '';
  }

  // Limpa a caixa de upload ao entrar na aba
  const uploadBox = document.getElementById('ligaUploadBox');
  if (uploadBox) { uploadBox.style.display = 'none'; uploadBox.innerHTML = ''; }
  _ligaDadosAtual = null;
}

function _mostrarBannerEdicao(nota) {
  const banner = document.getElementById('ligaEditBanner');
  if (!banner) return;
  banner.innerHTML = `
    <div class="banner-revisao" style="margin-bottom:1rem;">
      <strong>Modo de revisão</strong> — Edite os dados abaixo e reenvie para aprovação.
      ${nota ? `<br><strong>Nota do embaixador:</strong> ${nota}` : ''}
      <br><button onclick="cancelarEdicaoLiga()" style="margin-top:8px;background:transparent;border:1px solid rgba(48,112,200,0.4);border-radius:6px;color:#70a8f0;font-size:0.75rem;padding:3px 10px;cursor:pointer;font-family:sans-serif;">✕ Cancelar edição</button>
    </div>`;
}

function cancelarEdicaoLiga() {
  _ligaEditando = null;
  initLiga();
}

function _preencherFormularioEdicao(dados, todayStr) {
  const { local, data, mapa, jogadores } = dados || {};
  const localEl = document.getElementById('ligaLocal');
  const dataEl  = document.getElementById('ligaData');
  const mapaEl  = document.getElementById('ligaMapa');

  if (localEl && local) localEl.value = local;
  if (dataEl) dataEl.value = data || todayStr || '';
  if (mapaEl && mapa) mapaEl.value = mapa;

  if (!jogadores?.length) return;
  ligaNumPlayers = jogadores.length;
  renderLigaPlayers();

  jogadores.forEach((j, i) => {
    const nameEl  = document.getElementById('ligaName_' + i);
    const facEl   = document.getElementById('ligaFac_' + i);
    const vagEl   = document.getElementById('ligaVagType_' + i);
    const scoreEl = document.getElementById('ligaScore_' + i);
    const inEl    = document.getElementById('ligaIniciante_' + i);
    const vitEl   = document.getElementById('ligaVitDom_' + i);
    const derEl   = document.getElementById('ligaDerDom_' + i);

    if (nameEl && j.nome)  nameEl.value = j.nome;
    if (facEl  && j.facId) { facEl.value = j.facId; onFacChange(i); }
    if (vagEl  && j.vagType) vagEl.value = j.vagType;
    if (scoreEl && j.pontuacao != null) scoreEl.value = j.pontuacao;
    if (inEl) inEl.checked = !!j.iniciante;
    // vitória por domínio: vencedor sem pontuação
    if (vitEl && j.vencedor && j.pontuacao == null) vitEl.checked = true;
    // derrota por domínio: não vencedor sem pontuação
    if (derEl && !j.vencedor && j.pontuacao == null) derEl.checked = true;
  });

  updateFacSelects();
  updateVagSelects();
}

// Chamado pelo historico.js para editar uma partida em revisão
function editarPartidaRevisao(id, dados, nota) {
  _ligaEditando = { id, dados, nota_embaixador: nota };
  const btn = document.querySelector('.liga-tab[data-tab="liga"]');
  if (btn) switchTab('liga', btn);
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
    const vitDom  = document.getElementById('ligaVitDom_' + i)?.checked;
    const derDom  = document.getElementById('ligaDerDom_' + i)?.checked;
    const vagType = (facId === 'vagabond' || facId === 'vagabond2')
      ? (document.getElementById('ligaVagType_' + i)?.value || null) : null;

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
    const vitDom    = document.getElementById('ligaVitDom_' + i)?.checked;
    const derDom    = document.getElementById('ligaDerDom_' + i)?.checked;
    const vagType   = (facId === 'vagabond' || facId === 'vagabond2')
      ? (document.getElementById('ligaVagType_' + i)?.value || null) : null;

    let facName = LIGA_FACTIONS.find(f => f.id === facId)?.name || facId;
    if (vagType) facName = 'Malandro (' + vagType + ')';

    players.push({ name, facName, facId, vagType, score, iniciante, vitDom, derDom, derDomFlag: derDom, slotIdx: i });
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
  const jogadoresFinais = sorted.map((p, i) => {
    const ludo = (typeof getLudoDataParaSlot === 'function') ? getLudoDataParaSlot(p.slotIdx ?? i) : null;
    return {
      nome: p.name, faccao: p.facName, facId: p.facId, vagType: p.vagType || null,
      pontuacao: p.vitDom ? null : (p.derDomFlag ? null : p.score),
      vencedor: i === 0 && !p.derDomFlag,
      iniciante: p.iniciante,
      ludopedia_id: ludo?.ludopedia_id || null,
      ludopedia_usuario: ludo?.ludopedia_usuario || null,
    };
  });

  // Finaliza partida em andamento com os dados do resultado
  if (typeof finalizarPartida === 'function') finalizarPartida(jogadoresFinais);

  // Ludopedia — registro automático ao gerar resultado
  if (typeof autoRegistrarLudo === 'function') {
    autoRegistrarLudo({ local, data: dataVal, mapa, jogadores: jogadoresFinais }, 'ludoBtnContainerLiga');
  }

  // Guarda dados e exibe seção de upload para a liga
  _ligaDadosAtual = { local, data: dataVal, mapa, jogadores: jogadoresFinais };
  const uploadBox = document.getElementById('ligaUploadBox');
  if (uploadBox) { uploadBox.style.display = ''; renderUploadLiga(); }
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

// ── Upload e envio para a liga ────────────────────────────────────

function renderUploadLiga() {
  const box = document.getElementById('ligaUploadBox');
  if (!box) return;
  _ligaUploadPontuacao = null;
  _ligaUploadJogadores = null;

  if (!currentUser) {
    box.innerHTML = `
      <div class="section">
        <div class="section-title">Registrar na Liga</div>
        <p style="font-family:sans-serif;font-size:0.85rem;color:var(--text3);">
          <a onclick="showAuthModal()" style="color:var(--gold);cursor:pointer;">Faça login</a> para registrar a partida na liga.
        </p>
      </div>`;
    return;
  }

  const titulo = _ligaEditando ? 'Reenviar para Aprovação' : 'Registrar na Liga';
  const btnLabel = _ligaEditando ? '🔄 Reenviar para Aprovação' : '📤 Enviar para Aprovação';

  box.innerHTML = `
    <div class="section">
      <div class="section-title">${titulo}</div>
      <p style="font-family:sans-serif;font-size:0.78rem;color:var(--text3);margin-bottom:1rem;line-height:1.5;">
        Envie as fotos obrigatórias para que o embaixador possa aprovar a partida.
      </p>
      <div class="upload-area-wrap">
        <div class="upload-area" id="uploadAreaPontuacao" onclick="document.getElementById('inpFotoPontuacao').click()">
          <div id="previewPontuacao" class="upload-preview">
            <div class="upload-icon">📸</div>
            <div class="upload-label">Foto da Pontuação</div>
            <div class="upload-hint">Toque para selecionar</div>
          </div>
          <input type="file" id="inpFotoPontuacao" accept="image/*" style="display:none" onchange="onFotoLigaSelect('pontuacao',this)">
        </div>
        <div class="upload-area" id="uploadAreaJogadores" onclick="document.getElementById('inpFotoJogadores').click()">
          <div id="previewJogadores" class="upload-preview">
            <div class="upload-icon">👥</div>
            <div class="upload-label">Foto dos Jogadores</div>
            <div class="upload-hint">Toque para selecionar</div>
          </div>
          <input type="file" id="inpFotoJogadores" accept="image/*" style="display:none" onchange="onFotoLigaSelect('jogadores',this)">
        </div>
      </div>
      <button id="btnEnviarLiga" class="btn-liga" onclick="enviarParaLiga()" disabled style="margin-top:1rem;opacity:0.5;">${btnLabel}</button>
      <div id="ligaUploadStatus" style="font-family:sans-serif;font-size:0.82rem;min-height:20px;margin-top:8px;text-align:center;color:var(--text3);"></div>
    </div>`;
}

function onFotoLigaSelect(tipo, input) {
  const file = input.files[0];
  if (!file) return;
  if (tipo === 'pontuacao') _ligaUploadPontuacao = file;
  else _ligaUploadJogadores = file;

  const previewId = tipo === 'pontuacao' ? 'previewPontuacao' : 'previewJogadores';
  const areaId    = tipo === 'pontuacao' ? 'uploadAreaPontuacao' : 'uploadAreaJogadores';
  const preview   = document.getElementById(previewId);
  const area      = document.getElementById(areaId);

  if (preview) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;pointer-events:none;">`;
    };
    reader.readAsDataURL(file);
  }
  if (area) area.classList.add('has-image');

  const btn = document.getElementById('btnEnviarLiga');
  if (btn) {
    const ok = _ligaUploadPontuacao && _ligaUploadJogadores;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.5';
  }
}

async function enviarParaLiga() {
  if (!_ligaUploadPontuacao || !_ligaUploadJogadores || !_ligaDadosAtual) return;
  if (!currentUser) { showAuthModal(); return; }

  const btn    = document.getElementById('btnEnviarLiga');
  const status = document.getElementById('ligaUploadStatus');
  if (btn) btn.disabled = true;
  if (status) { status.style.color = 'var(--gold)'; status.textContent = 'Enviando fotos...'; }

  try {
    const sb      = await initSupabase();
    const uid     = currentUser.id;
    const matchId = _ligaEditando?.id || crypto.randomUUID();
    const ext1    = (_ligaUploadPontuacao.name.split('.').pop() || 'jpg').toLowerCase();
    const ext2    = (_ligaUploadJogadores.name.split('.').pop() || 'jpg').toLowerCase();
    const path1   = `${uid}/${matchId}/pontuacao.${ext1}`;
    const path2   = `${uid}/${matchId}/jogadores.${ext2}`;

    const { error: e1 } = await sb.storage.from('fotos-partidas').upload(path1, _ligaUploadPontuacao, { upsert: true });
    if (e1) throw e1;
    if (status) status.textContent = 'Enviando segunda foto...';

    const { error: e2 } = await sb.storage.from('fotos-partidas').upload(path2, _ligaUploadJogadores, { upsert: true });
    if (e2) throw e2;

    const { data: d1 } = sb.storage.from('fotos-partidas').getPublicUrl(path1);
    const { data: d2 } = sb.storage.from('fotos-partidas').getPublicUrl(path2);

    if (status) status.textContent = 'Registrando partida...';

    const nomeUser = currentUser.user_metadata?.display_name
      || currentUser.user_metadata?.full_name
      || currentUser.email?.split('@')[0] || 'Usuário';
    const dadosFinais = { ..._ligaDadosAtual, submitter_name: nomeUser };

    if (_ligaEditando) {
      const { error: e3 } = await sb.from('partidas_liga').update({
        status: 'pendente_aprovacao',
        dados: dadosFinais,
        foto_pontuacao_url: d1.publicUrl,
        foto_jogadores_url: d2.publicUrl,
        nota_embaixador: null,
        atualizado_em: new Date().toISOString(),
      }).eq('id', matchId);
      if (e3) throw e3;
    } else {
      const { error: e3 } = await sb.from('partidas_liga').insert({
        id: matchId,
        user_id: uid,
        status: 'pendente_aprovacao',
        dados: dadosFinais,
        foto_pontuacao_url: d1.publicUrl,
        foto_jogadores_url: d2.publicUrl,
      });
      if (e3) throw e3;
    }

    _ligaEditando = null;
    if (status) { status.style.color = '#80d060'; status.textContent = '✓ Partida enviada! Aguardando aprovação do embaixador.'; }
    if (btn) { btn.textContent = '✓ Enviado'; btn.disabled = true; btn.style.opacity = '1'; }
  } catch (e) {
    if (status) { status.style.color = '#f09080'; status.textContent = 'Erro: ' + (e.message || 'falha ao enviar'); }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

// Inicialização — executada após todos os scripts carregarem
init();
sbLoadCounters();
initSupabase();
restaurarPartidaSeExistir();
if (typeof initLudopedia === 'function') initLudopedia();

// Define hash inicial se não houver nenhum (e não estiver em callback OAuth)
if (!window.location.hash && !window.location.search.includes('code=')) {
  const saved = localStorage.getItem('ligaActiveTab') || 'sorteio';
  history.replaceState({ tab: saved }, '', '#' + saved);
}