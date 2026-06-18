// Lógica de sorteio de facções e clareiras

const SUIT_EMOJI  = { F: '🦊', R: '🐭', C: '🐇' };

// ===================== ESTADO =====================
let numPlayers = 3;
let selectedExpansions = new Set(['base']);
let allowV2 = false;
let selectedMaps = new Set(['autumn']);
let sortearClareiras = false;
let manterCantos = true;
let sortearDeck = false;
let minInsurgentes = 0; // 0=livre, 1=ao menos 1, 2=ao menos 2

// ===================== INIT =====================
function init() {
  renderPlayersGrid();
  renderExpansions();
  renderMaps();
  updateReachInfo();
  setTimeout(restoreTabFromHash, 50);
}

function updateInsurgentToggle() {
  const row = document.getElementById('insurgentToggleRow');
  const inner = document.getElementById('insurgentToggleInner');
  if (!row || !inner) return;

  // Max insurgentes possíveis = numPlayers - 1 (precisa ao menos 1 militante), máximo 3
  const maxOpts = Math.min(numPlayers - 1, 3);

  if (numPlayers >= 3) {
    row.style.display = 'flex';
    document.getElementById('insurgentToggleSub').textContent =
      'Controle a quantidade mínima de facções insurgentes no grupo';

    let html = `<label class="liga-check" style="margin-bottom:4px">
        <input type="radio" name="insOpt" value="0" checked onchange="minInsurgentes=0" style="accent-color:var(--gold)">
        <span>Livre</span>
      </label>`;

    const labels = ['Ao menos 1 insurgente','Ao menos 2 insurgentes','Ao menos 3 insurgentes'];
    for (let i = 1; i <= maxOpts; i++) {
      html += `<label class="liga-check" style="margin-bottom:4px">
        <input type="radio" name="insOpt" value="${i}" onchange="minInsurgentes=${i}" style="accent-color:var(--gold)">
        <span>${labels[i-1]}</span>
      </label>`;
    }
    inner.innerHTML = html;
  } else {
    row.style.display = 'none';
    minInsurgentes = 0;
  }
}

function renderPlayersGrid() {
  const grid = document.getElementById('playersGrid');
  if (!grid) return;

  numPlayers = typeof _playersForMatch !== 'undefined' ? _playersForMatch.length : numPlayers;

  // Guarda facções já selecionadas para restaurar
  const existingFacs = [];
  grid.querySelectorAll('select.player-fac-sel').forEach(s => existingFacs.push(s.value));

  grid.innerHTML = '';

  // Botões de adicionar jogador
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:8px;margin-bottom:0.75rem;';
  addRow.innerHTML = `
    <button class="btn-sortear" style="flex:1;padding:0.5rem;font-size:0.82rem;" onclick="abrirSelecionarJogadoresModal()">
      👥 Selecionar jogadores
    </button>
    <button class="ludo-btn-sm" style="padding:0.5rem 0.75rem;font-size:0.82rem;" onclick="_adicionarConvidadoPrompt()">
      + Convidado
    </button>`;
  grid.appendChild(addRow);

  if (!_playersForMatch || !_playersForMatch.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:1rem;font-family:sans-serif;font-size:0.82rem;color:var(--text3);';
    empty.textContent = 'Nenhum jogador selecionado';
    grid.appendChild(empty);
    updatePlayerFacOptions();
    return;
  }

  _playersForMatch.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'player-field';
    d.innerHTML = `
      <div class="player-chip-row">
        <span class="player-chip-name">${p.nome}</span>
        ${p.ludopedia_id ? '<span class="player-ludo-badge">🎲</span>' : ''}
        ${p.isGuest ? '<span class="player-guest-badge">convidado</span>' : ''}
        <button onclick="removerPlayerMatch(${i})" class="player-chip-remove" title="Remover">✕</button>
      </div>
      <div class="player-fac-select">
        <label>Facção:</label>
        <select class="player-fac-sel" id="playerFac_${i}" onchange="onPlayerFacChange()">
          <option value="">— livre —</option>
        </select>
      </div>`;
    grid.appendChild(d);
  });

  updatePlayerFacOptions();

  // Restaura facções selecionadas
  existingFacs.forEach((fac, i) => {
    const sel = document.getElementById('playerFac_' + i);
    if (sel && fac) sel.value = fac;
  });
}

function updatePlayerFacOptions() {
  // Get all chosen factions
  const chosen = [];
  for (let i = 0; i < numPlayers; i++) {
    const sel = document.getElementById('playerFac_' + i);
    if (sel && sel.value) chosen.push({ idx: i, val: sel.value });
  }

  for (let i = 0; i < numPlayers; i++) {
    const sel = document.getElementById('playerFac_' + i);
    if (!sel) continue;
    const current = sel.value;
    const avail = getAvailableFactions();
    const otherChosen = chosen.filter(c => c.idx !== i).map(c => c.val);

    sel.innerHTML = '<option value="">— livre —</option>';
    avail.forEach(f => {
      if (otherChosen.includes(f.id)) return; // já escolhida por outro
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      if (f.id === current) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.className = 'player-fac-sel' + (sel.value ? ' chosen' : '');
  }
  checkPreselectionReach();
}

function onPlayerFacChange() {
  updatePlayerFacOptions();
}

function getPreselectedFactions() {
  const pre = [];
  for (let i = 0; i < numPlayers; i++) {
    const sel = document.getElementById('playerFac_' + i);
    if (sel && sel.value) pre.push(sel.value);
  }
  return pre;
}

function checkPreselectionReach() {
  const warnBox = document.getElementById('reachWarnBox');
  if (!warnBox) return;
  const pre = getPreselectedFactions();
  if (pre.length === 0) { warnBox.style.display = 'none'; return; }

  const min = REACH_MIN[numPlayers];
  const avail = getAvailableFactions();
  const preReach = pre.reduce((s, id) => {
    const f = avail.find(f => f.id === id);
    return s + (f ? f.reach : 0);
  }, 0);

  // Max possible reach: pre-selected + best available for remaining slots
  const remaining = numPlayers - pre.length;
  const freeAvail = avail.filter(f => !pre.includes(f.id))
    .sort((a,b) => b.reach - a.reach)
    .slice(0, remaining);
  const maxPossible = preReach + freeAvail.reduce((s,f) => s + f.reach, 0);

  if (maxPossible < min) {
    warnBox.style.display = 'block';
    warnBox.innerHTML = `<strong>⚠️ Atenção — Regra de Alcance</strong><br>
      Com as facções pré-selecionadas, o alcance máximo possível é <strong>${maxPossible}</strong>,
      abaixo do mínimo de <strong>${min}</strong> para ${numPlayers} jogadores.<br><br>
      Pelas regras oficiais da Leder Games, esse grupo pode gerar desequilíbrio,
      oferecendo <strong>muita vantagem ou desvantagem</strong> para algum jogador.
      Considere alterar as escolhas.`;
  } else if (preReach > 0 && preReach < min && remaining === 0) {
    warnBox.style.display = 'block';
    warnBox.innerHTML = `<strong>⚠️ Atenção — Regra de Alcance</strong><br>
      O alcance total das facções escolhidas é <strong>${preReach}</strong>,
      abaixo do mínimo de <strong>${min}</strong> para ${numPlayers} jogadores.<br><br>
      Pelas regras oficiais da Leder Games, esse grupo pode gerar desequilíbrio significativo.`;
  } else {
    warnBox.style.display = 'none';
  }
}

// ===================== EXPANSÕES =====================
function renderExpansions() {
  const grid = document.getElementById('expansionsGrid');
  grid.innerHTML = '';
  EXPANSIONS.forEach(exp => {
    const row = document.createElement('label');
    row.className = 'exp-row' + (selectedExpansions.has(exp.id) ? ' selected' : '');
    row.innerHTML = `
      <input type="checkbox" ${selectedExpansions.has(exp.id)?'checked':''}>
      <div style="flex:1">
        <div class="exp-name">${exp.name}</div>
        <div class="exp-facs">${exp.desc}</div>
        ${exp.hasV2 ? `<div id="v2wrap_${exp.id}"></div>` : ''}
      </div>`;
    const cb = row.querySelector('input');
    cb.onchange = () => {
      if (cb.checked) {
        selectedExpansions.add(exp.id);
      } else {
        if (selectedExpansions.size <= 1) {
          cb.checked = true; // mínimo 1 expansão
          return;
        }
        selectedExpansions.delete(exp.id);
        if (exp.id === 'riverfolk') allowV2 = false;
      }
      row.classList.toggle('selected', selectedExpansions.has(exp.id));
      if (exp.hasV2) renderV2Option(exp.id, selectedExpansions.has(exp.id));
      updateReachInfo();
    };
    grid.appendChild(row);
    if (exp.hasV2) renderV2Option(exp.id, selectedExpansions.has(exp.id));
  });
}

function renderV2Option(expId, show) {
  const wrap = document.getElementById('v2wrap_' + expId);
  if (!wrap) return;
  if (!show) { wrap.innerHTML=''; return; }
  wrap.innerHTML = `
    <label class="sub-option" style="margin-top:8px">
      <input type="checkbox" id="v2cb" ${allowV2?'checked':''} style="accent-color:var(--gold)">
      <span class="sub-option-label">Incluir <strong style="color:var(--text)">Malandro 2</strong> (segundo Malandro)</span>
    </label>`;
  document.getElementById('v2cb').onchange = function() {
    allowV2 = this.checked;
    updateReachInfo();
  };
}

// ===================== MAPAS =====================
function renderMaps() {
  const grid = document.getElementById('mapsGrid');
  grid.innerHTML = '';
  MAPS.forEach(map => {
    const card = document.createElement('label');
    card.className = 'map-card' + (selectedMaps.has(map.id) ? ' selected' : '');
    card.innerHTML = `
      <input type="checkbox" ${selectedMaps.has(map.id)?'checked':''} style="accent-color:var(--gold)">
      <div class="map-icon">${map.icon}</div>
      <div class="map-name">${map.name}</div>
      <div class="map-desc">${map.desc}</div>`;
    const cb = card.querySelector('input');
    cb.onchange = () => {
      if (cb.checked) selectedMaps.add(map.id);
      else if (selectedMaps.size > 1) selectedMaps.delete(map.id);
      else { cb.checked = true; return; } // mínimo 1
      card.classList.toggle('selected', selectedMaps.has(map.id));
      updateMapNote();
    };
    grid.appendChild(card);
  });
  updateMapNote();
}

function updateMapNote() {
  document.getElementById('mapSortNote').style.display = selectedMaps.size > 1 ? 'block' : 'none';
}

// ===================== CLAREIRAS =====================
function toggleDeck(checked) {
  sortearDeck = checked;
  document.getElementById('deckToggleRow').classList.toggle('active', checked);
}

function toggleClearing(checked) {
  sortearClareiras = checked;
  document.getElementById('clearingToggleRow').classList.toggle('active', checked);
  document.getElementById('clearingOptions').style.display = checked ? 'block' : 'none';
}

// ===================== FACÇÕES =====================
function getAvailableFactions() {
  const facs = [];
  for (const [id, f] of Object.entries(FACTIONS)) {
    if (id === 'vagabond2' && !allowV2) continue;
    if (selectedExpansions.has(f.exp)) facs.push({ id, ...f });
  }
  return facs;
}

function updateReachInfo() {
  updatePlayerFacOptions();
  const facs = getAvailableFactions();
  const mil = facs.filter(f => f.type==='militant').length;
  const ins = facs.filter(f => f.type==='insurgent').length;
  const min = REACH_MIN[numPlayers];
  document.getElementById('reachInfo').innerHTML = `
    <strong>Regra de Alcance (${numPlayers} jogadores):</strong> soma mínima de ${min}.<br>
    Facções disponíveis: ${facs.length} (${mil} militantes + ${ins} insurgentes).<br>
    O sorteio garante ao menos 1 militante e alcance mínimo atingido.
  `;
}

function getPlayerNames() {
  if (typeof _playersForMatch !== 'undefined' && _playersForMatch.length) {
    return _playersForMatch.map((p, i) => p.nome || `Jogador ${i+1}`);
  }
  return [];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// ===================== SORTEIO PRINCIPAL =====================
function sortear() {
  document.getElementById('errorMsg').style.display = 'none';

  const names = getPlayerNames();
  const n = numPlayers;
  const avail = getAvailableFactions();
  const min = REACH_MIN[n];

  // ── Validação detalhada ──────────────────────────────────────────────────
  const erros = [];

  // Sem expansões selecionadas
  if (selectedExpansions.size === 0) {
    erros.push('Nenhuma expansão selecionada. Marque ao menos uma expansão para continuar.');
  }

  // Facções insuficientes
  if (avail.length < n) {
    const faltam = n - avail.length;
    erros.push(
      `Facções insuficientes: há ${avail.length} facção(ões) disponível(is) para ${n} jogadores (faltam ${faltam}).`
    );
    // Sugerir o que habilitar
    const sugestoes = [];
    if (!selectedExpansions.has('base'))       sugestoes.push('Jogo Base (+4 facções)');
    if (!selectedExpansions.has('underworld')) sugestoes.push('Submundo (+2 facções)');
    if (!selectedExpansions.has('marauder'))   sugestoes.push('Saqueadores (+2 facções)');
    if (!selectedExpansions.has('riverfolk'))  sugestoes.push('Ribeirinhos (+2 ou +3 facções)');
    if (!selectedExpansions.has('homeland'))   sugestoes.push('Pátria (+3 facções)');
    if (sugestoes.length > 0) {
      erros.push('Sugestão — habilite: ' + sugestoes.join(', ') + '.');
    }
  }

  // Alcance insuficiente mesmo com facções suficientes
  if (erros.length === 0) {
    const totalReachAvail = avail.reduce((s,f) => s + f.reach, 0);
    // Máximo alcance possível com n facções (pegar as n de maior alcance)
    const sorted = [...avail].sort((a,b) => b.reach - a.reach);
    const maxReach = sorted.slice(0, n).reduce((s,f) => s + f.reach, 0);
    if (maxReach < min) {
      erros.push(
        `Alcance insuficiente: o máximo possível com as facções disponíveis é ${maxReach}, mas o mínimo para ${n} jogadores é ${min}.`
      );
      erros.push('Habilite mais expansões ou reduza o número de jogadores.');
    }
  }

  // Insurgente garantido mas não há insurgentes suficientes
  if (erros.length === 0 && minInsurgentes > 0) {
    const insAvail = avail.filter(f => f.type === 'insurgent').length;
    if (insAvail < minInsurgentes) {
      erros.push(
        `Não há insurgentes suficientes: você pediu ao menos ${minInsurgentes} insurgente(s), mas só há ${insAvail} disponível(is).`
      );
    }
    // Também precisa de ao menos 1 militante
    const milAvail = avail.filter(f => f.type === 'militant').length;
    if (n - minInsurgentes > milAvail) {
      erros.push(
        `Militantes insuficientes para completar o grupo com ${minInsurgentes} insurgente(s) — só há ${milAvail} militante(s) disponível(is).`
      );
    }
  }

  if (erros.length > 0) {
    showError(erros.join('\n\n'));
    return;
  }
  // ────────────────────────────────────────────────────────────────────────

  const preSelected = getPreselectedFactions();
  const facResult = drawFactions(avail, n, min, preSelected);
  if (!facResult) {
    showError(`Não foi possível montar um grupo válido com as configurações atuais.\n\nTente habilitar mais expansões, reduzir o número de jogadores ou ajustar a opção de insurgentes.`);
    return;
  }

  // Mapa
  const mapArr = MAPS.filter(m => selectedMaps.has(m.id));
  const chosenMap = mapArr.length === 1 ? mapArr[0] : mapArr[Math.floor(Math.random()*mapArr.length)];

  // Deck
  const DECKS = ['Deck Base', 'Exilados & Partisans'];
  const chosenDeck = sortearDeck ? DECKS[Math.floor(Math.random()*DECKS.length)] : null;

  // Clareiras
  let clearingResult = null;
  if (sortearClareiras) {
    manterCantos = document.getElementById('cornerToggle').checked;
    clearingResult = drawClearings(chosenMap, manterCantos);
  }

  sbIncrement('sorteio');
  if (mapArr.length > 1) sbIncrement('mapa');
  renderResult(facResult, names, chosenMap, mapArr.length > 1, clearingResult, chosenDeck);
  // Cria partida em andamento se usuário logado ou sempre (salva local)
  const shuffledNamesForPartida = shuffle(names);
  criarPartida(facResult, shuffledNamesForPartida, chosenMap, chosenDeck);
  atualizarBadgePartida(true);
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.innerHTML = msg.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function drawFactions(avail, n, minReach) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const candidate = shuffle(avail).slice(0, n);
    const hasMilitant = candidate.some(f => f.type==='militant');
    const hasInsurgent = candidate.some(f => f.type==='insurgent');
    if (!hasMilitant && n >= 2) continue;
    const insCount = candidate.filter(f => f.type==='insurgent').length;
    if (minInsurgentes > 0 && insCount < minInsurgentes) continue;
    // Malandro 2 só pode entrar se o Malandro 1 também estiver no grupo
    const hasV2 = candidate.some(f => f.id === 'vagabond2');
    const hasV1 = candidate.some(f => f.id === 'vagabond');
    if (hasV2 && !hasV1) continue;
    if (candidate.reduce((s,f) => s+f.reach, 0) < minReach) continue;
    const mil = candidate.filter(f => f.type==='militant');
    const ins = candidate.filter(f => f.type==='insurgent');
    return {
      chosen: candidate,
      setupOrder: [...shuffle(mil), ...shuffle(ins)],
      turnOrder: shuffle(candidate),
      totalReach: candidate.reduce((s,f) => s+f.reach, 0)
    };
  }
  return null;
}

// ===================== SORTEIO DE CLAREIRAS =====================
function drawClearings(map, keepCorners) {
  const total = map.clearings.length; // 12 — clearings agora é array de objetos
  const originalSuits = [...map.suits];
  const corners = map.corners || [0,3,8,11];

  let fixedSuits = {};
  let freePositions = [];
  let freeSuits = [];

  if (keepCorners) {
    corners.forEach(i => { fixedSuits[i] = originalSuits[i]; });
    for (let i=0; i<total; i++) {
      if (!corners.includes(i)) freePositions.push(i);
    }
    const counts = { F:0, R:0, C:0 };
    corners.forEach(i => counts[originalSuits[i]]++);
    const perSuit = total / 3;
    freeSuits = [];
    ['F','R','C'].forEach(s => {
      for (let k=0; k < perSuit - counts[s]; k++) freeSuits.push(s);
    });
  } else {
    freePositions = Array.from({length: total}, (_,i) => i);
    const perSuit = total / 3;
    freeSuits = [];
    ['F','R','C'].forEach(s => { for(let k=0;k<perSuit;k++) freeSuits.push(s); });
  }

  const shuffledFree = shuffle(freeSuits);
  const result = new Array(total);
  corners.forEach(i => { if (fixedSuits[i]) result[i] = fixedSuits[i]; });
  freePositions.forEach((pos,i) => { result[pos] = shuffledFree[i]; });

  return result;
}

// ===================== RENDER RESULTADO =====================
let _lastFacResult = null;
let _lastNames = null;
let _lastMap = null;

function renderResult(facResult, names, chosenMap, wasDrawn, clearingResult, chosenDeck) {
  _lastFacResult = facResult;
  _lastNames = names;
  _lastMap = chosenMap;
  const section = document.getElementById('resultSection');
  const cards = document.getElementById('resultCards');
  const summary = document.getElementById('summaryBox');
  const mapDiv = document.getElementById('resultMap');
  const clearDiv = document.getElementById('resultClearing');

  let subtitleParts = [names.length + ' jogadores', chosenMap.name, 'Alcance: ' + facResult.totalReach];
  if (chosenDeck) subtitleParts.push('🃏 ' + chosenDeck);
  document.getElementById('resultSubtitle').textContent = subtitleParts.join(' · ');

  // Associar nomes
  const shuffledNames = shuffle(names);
  const playerFaction = {};
  facResult.turnOrder.forEach((fac,i) => { playerFaction[fac.id] = shuffledNames[i]; });

  // --- MAPA SORTEADO ---
  mapDiv.innerHTML = '';
  const mapCard = document.createElement('div');
  mapCard.className = 'map-result-card';
  mapCard.innerHTML = `
    <div class="map-result-label">${wasDrawn ? 'Mapa Sorteado' : 'Mapa'}</div>
    <div class="map-result-icon">${chosenMap.icon}</div>
    <div class="map-result-name">${chosenMap.name}</div>
    <div class="map-result-desc">${chosenMap.desc}</div>
  `;
  mapDiv.appendChild(mapCard);

  if (chosenDeck) {
    const deckCard = document.createElement('div');
    deckCard.className = 'map-result-card';
    deckCard.style.marginTop = '1rem';
    deckCard.innerHTML = `
      <div class="map-result-label">Deck Sorteado</div>
      <div class="map-result-icon">🃏</div>
      <div class="map-result-name">${chosenDeck}</div>
    `;
    mapDiv.appendChild(deckCard);
  }

  // --- CLAREIRAS ---
  clearDiv.innerHTML = '';
  if (clearingResult) {
    const boardWrap = document.createElement('div');
    boardWrap.className = 'board-wrapper';
    boardWrap.innerHTML = `
      <div class="board-title">Naipes das Clareiras — ${chosenMap.name}</div>
      <div id="boardSvgWrap" style="position:relative;width:100%;"></div>
      <div class="clearing-legend">
        <div class="legend-item"><div class="legend-dot legend-fox"></div> 🦊 Raposa (vermelho)</div>
        <div class="legend-item"><div class="legend-dot legend-mouse"></div> 🐭 Rato (laranja)</div>
        <div class="legend-item"><div class="legend-dot legend-rabbit"></div> 🐇 Coelho (amarelo)</div>
      </div>
    `;
    clearDiv.appendChild(boardWrap);
    renderBoardSVG('boardSvgWrap', clearingResult, chosenMap);
  }

  // --- FACÇÕES ---
  cards.innerHTML = '';

  // Seção preparação
  cards.insertAdjacentHTML('beforeend', `
    <div class="divider-section">
      <div class="divider-label">Ordem de Preparação</div>
      <hr class="divider-line">
    </div>`);

  facResult.setupOrder.forEach((fac, i) => {
    const player = playerFaction[fac.id];
    const card = document.createElement('div');
    card.className = `result-card faction-accent-${fac.accent}`;
    card.innerHTML = `
      <div class="order-badge">${i+1}°</div>
      <div class="card-player">${player}</div>
      <div class="card-faction">${fac.name}</div>
      <span class="card-type-badge ${fac.type==='militant'?'badge-militant':'badge-insurgent'}">${fac.type==='militant'?'⚔ Militante':'◆ Insurgente'}</span>
      <div class="card-reach">Alcance: ${fac.reach}</div>
      <div class="card-setup-order">Prepara-se ${fac.type==='militant'?'antes dos insurgentes':'após os militantes'}</div>`;
    cards.appendChild(card);
  });

  // Seção ordem de jogo
  cards.insertAdjacentHTML('beforeend', `
    <div class="divider-section" style="margin-top:2rem">
      <div class="divider-label">Ordem de Jogo (1º turno)</div>
      <hr class="divider-line">
    </div>`);

  facResult.turnOrder.forEach((fac, i) => {
    const player = playerFaction[fac.id];
    const card = document.createElement('div');
    card.className = `result-card faction-accent-${fac.accent}`;
    card.innerHTML = `
      <div class="order-badge">${i+1}°</div>
      <div class="card-player">${player}</div>
      <div class="card-faction">${fac.name}</div>
      <span class="card-type-badge ${fac.type==='militant'?'badge-militant':'badge-insurgent'}">${fac.type==='militant'?'⚔ Militante':'◆ Insurgente'}</span>`;
    cards.appendChild(card);
  });

  // Resumo
  const minReach = REACH_MIN[names.length];
  const reachOk = facResult.totalReach >= minReach;
  const suitCounts = clearingResult
    ? `<div class="summary-row">
         <span class="summary-key">Clareiras</span>
         <span class="summary-val" style="font-size:0.82rem">
           🦊 Raposa ×${clearingResult.filter(s=>s==='F').length} &nbsp;
           🐭 Rato ×${clearingResult.filter(s=>s==='R').length} &nbsp;
           🐇 Coelho ×${clearingResult.filter(s=>s==='C').length}
         </span>
       </div>` : '';

  summary.innerHTML = `
    <div class="summary-title">Resumo</div>
    <div class="summary-row"><span class="summary-key">Jogadores</span><span class="summary-val">${names.length}</span></div>
    <div class="summary-row"><span class="summary-key">Mapa</span><span class="summary-val">${chosenMap.icon} ${chosenMap.name}</span></div>
    <div class="summary-row"><span class="summary-key">Alcance total</span>
      <span class="summary-val ${reachOk?'reach-ok':'reach-warn'}">
        ${facResult.totalReach} ${reachOk?'✓ (mín. '+minReach+')':'✗ (mín. '+minReach+')'}
      </span>
    </div>
    <div class="summary-row"><span class="summary-key">Militantes</span><span class="summary-val">${facResult.chosen.filter(f=>f.type==='militant').length}</span></div>
    <div class="summary-row"><span class="summary-key">Insurgentes</span><span class="summary-val">${facResult.chosen.filter(f=>f.type==='insurgent').length}</span></div>
    ${suitCounts}
    <div class="summary-row"><span class="summary-key">Facções</span>
      <span class="summary-val" style="font-size:0.82rem;text-align:right">${facResult.setupOrder.map(f=>f.name).join(', ')}</span>
    </div>`;

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const btnC = document.getElementById('btnContinuarLiga');
  if (btnC) btnC.style.display = 'block';
}

// ===================== SVG DO TABULEIRO =====================
function renderBoardSVG(wrapperId, suits, map) {
  var wrap = document.getElementById(wrapperId);
  if (!wrap) return;

  // Técnica do original: img + SVG overlay absoluto com mesmo viewBox
  var bgSrc = MAP_IMAGES[map.img || map.id] || '';

  wrap.style.position = 'relative';
  wrap.innerHTML = '';

  // Imagem de fundo
  var img = document.createElement('img');
  img.src = bgSrc;
  img.style.cssText = 'width:100%;display:block;border-radius:8px;user-select:none;';
  wrap.appendChild(img);

  // SVG overlay
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', map.viewBox);
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';

  map.clearings.forEach(function(cl, i) {
    var suit = suits[i];
    var color = SUIT_COLORS[suit] || '#aaa';
    var label = String(cl.n);

    // Sombra
    var shadow = document.createElementNS(svgNS, 'circle');
    shadow.setAttribute('cx', cl.x + 2);
    shadow.setAttribute('cy', cl.y + 3);
    shadow.setAttribute('r', cl.r);
    shadow.setAttribute('fill', 'rgba(0,0,0,0.35)');
    svg.appendChild(shadow);

    // Círculo colorido
    var circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', cl.x);
    circle.setAttribute('cy', cl.y);
    circle.setAttribute('r', cl.r);
    circle.setAttribute('fill', color);
    circle.setAttribute('fill-opacity', '0.92');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '3');
    svg.appendChild(circle);

    // Número
    var text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', cl.x);
    text.setAttribute('y', cl.y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', label.length > 1 ? cl.r * 0.9 : cl.r);
    text.setAttribute('fill', '#1a0f00');
    text.setAttribute('font-family', 'sans-serif');
    text.setAttribute('font-weight', 'bold');
    text.textContent = label;
    svg.appendChild(text);
  });

  wrap.appendChild(svg);
}

function continuarParaLiga() {
  if (!_lastFacResult || !_lastNames) return;

  // Switch to liga tab
  const ligaBtn = document.querySelector('.liga-tab:last-child');
  switchTab('liga', ligaBtn);

  // Wait for DOM to render
  setTimeout(() => {
    // Set number of players
    ligaNumPlayers = _lastNames.length;
    renderLigaPlayers();

    // Set today's date
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const dd = String(today.getDate()).padStart(2,'0');
    const dateEl = document.getElementById('ligaData');
    if (dateEl && !dateEl.value) dateEl.value = yyyy+'-'+mm+'-'+dd;

    // Set map
    if (_lastMap) {
      const mapSel = document.getElementById('ligaMapa');
      if (mapSel) {
        Array.from(mapSel.options).forEach(opt => {
          if (opt.textContent.includes(_lastMap.name)) mapSel.value = opt.value;
        });
      }
    }

    // Map player names and factions from turnOrder
    // turnOrder = order of play; match names to factions
    const shuffledNames = [..._lastNames];
    // We need to re-derive: in renderResult, names were shuffled to assign factions
    // Use _lastFacResult.turnOrder factions, assigned to shuffled names
    // Re-shuffle with same logic isn't possible, so we'll assign in setup order
    const setupOrder = _lastFacResult.setupOrder;

    setupOrder.forEach((fac, i) => {
      // Find which player got this faction from turnOrder
      const turnIdx = _lastFacResult.turnOrder.findIndex(f => f.id === fac.id);
      const playerName = shuffledNames[turnIdx] || _lastNames[i] || '';

      const nameEl = document.getElementById('ligaName_' + i);
      const facEl  = document.getElementById('ligaFac_' + i);

      if (nameEl) nameEl.value = playerName;
      if (facEl) {
        // Find matching option
        const facId = fac.id === 'vagabond2' ? 'vagabond2' : fac.id;
        Array.from(facEl.options).forEach(opt => { if (opt.value === facId) opt.selected = true; });
        onFacChange(i);
        updateFacSelects();
        // Set vagabond type if applicable
        if (fac.id === 'vagabond' || fac.id === 'vagabond2') {
          updateVagSelects();
        }
      }
    });

    document.getElementById('tab-liga').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

function resetar() { sortear(); }