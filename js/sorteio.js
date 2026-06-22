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
let _lastSetupOrder = null;
let _lastTurnOrder = null;
let _lastChosenMap = null;
let _lastWasDrawn = false;
let _lastClearingResult = null;
let _lastChosenDeck = null;

function computeSorteioTurnOrder(setupOrder) {
  if (!Array.isArray(setupOrder) || setupOrder.length === 0) return [];
  return [...setupOrder].reverse();
}

function onSorteioSetupDragStart(event, idx) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(idx));
}

function onSorteioSetupDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function onSorteioSetupDrop(event, targetIdx) {
  event.preventDefault();
  const sourceIdx = parseInt(event.dataTransfer.getData('text/plain'), 10);
  if (Number.isNaN(sourceIdx) || sourceIdx === targetIdx || targetIdx === 0 || sourceIdx === 0) return;

  const order = Array.isArray(_lastSetupOrder) ? [..._lastSetupOrder] : [];
  if (!order.length || sourceIdx >= order.length || targetIdx >= order.length) return;

  const [moved] = order.splice(sourceIdx, 1);
  const insertAt = sourceIdx < targetIdx ? targetIdx - 1 : targetIdx;
  order.splice(insertAt, 0, moved);
  updateSorteioSetupOrder(order);
}

function updateSorteioSetupOrder(order) {
  if (!Array.isArray(order) || !order.length) return;
  _lastSetupOrder = order;
  _lastTurnOrder = computeSorteioTurnOrder(order);

  if (typeof partidaAtual !== 'undefined' && partidaAtual) {
    const seatingOrder = order.map(o => o.player);
    const startOrder = _lastTurnOrder.map(o => o.player);
    
    partidaAtual.jogadores = order.map(o => ({
      nome: o.player,
      faccao: o.facName,
      faccaoId: o.facId,
      tipo: o.type,
    }));
    partidaAtual.seatingOrder = seatingOrder;
    partidaAtual.startOrder = startOrder;
    partidaAtual.turnOrder = startOrder;
    localStorage.setItem('partidaAtual', JSON.stringify(partidaAtual));
  }

  renderResult(_lastFacResult, _lastNames, _lastChosenMap, _lastWasDrawn, _lastClearingResult, _lastChosenDeck, _lastPlayerFaction);
}

// ===================== INIT =====================
function init() {
  renderCountBtns();
  renderPlayersGrid();
  renderExpansions();
  renderMaps();
  updateReachInfo();
  setTimeout(restoreTabFromHash, 50);
}

function renderCountBtns() {
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.n) === numPlayers);
    btn.onclick = () => {
      numPlayers = parseInt(btn.dataset.n);
      minInsurgentes = 0;
      renderCountBtns();
      renderPlayersGrid();
      updateReachInfo();
      updateInsurgentToggle();
    };
  });
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

  const existingNames = [];
  const existingFacs  = [];
  grid.querySelectorAll('input.player-name-input').forEach(i => existingNames.push(i.value));
  grid.querySelectorAll('select.player-fac-sel').forEach(s => existingFacs.push(s.value));
  grid.innerHTML = '';

  for (let i = 0; i < numPlayers; i++) {
    const d = document.createElement('div');
    d.className = 'player-field';
    d.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <label style="flex:1;margin:0;">Jogador ${i+1}</label>
        <button class="player-slot-plus" onclick="abrirPainelSlot(${i})" title="Selecionar jogador cadastrado">+</button>
      </div>
      <input type="text" class="player-name-input" id="playerName_${i}"
        placeholder="Nome do jogador ${i+1}"
        value="${existingNames[i] || ''}"
        autocomplete="off"
        onblur="if(!this.value.trim()&&typeof limparSlotLudo==='function')limparSlotLudo(${i})">
      <div class="player-slot-badge" id="playerSlotBadge_${i}"></div>
      <div class="player-fac-select">
        <label>Facção:</label>
        <select class="player-fac-sel" id="playerFac_${i}" onchange="onPlayerFacChange()">
          <option value="">— livre —</option>
        </select>
      </div>`;
    grid.appendChild(d);
  }

  updatePlayerFacOptions();
  existingFacs.forEach((fac, i) => {
    const sel = document.getElementById('playerFac_' + i);
    if (sel && fac) sel.value = fac;
  });
  // Restaura badges dos slots que já tinham jogador vinculado
  if (typeof _refreshAllSlotBadges === 'function') _refreshAllSlotBadges();
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
  const names = [];
  for (let i = 0; i < numPlayers; i++) {
    const inp = document.getElementById('playerName_' + i);
    names.push(inp ? (inp.value.trim() || `Jogador ${i+1}`) : `Jogador ${i+1}`);
  }
  return names;
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
  _lastSetupOrder = null;
  _lastTurnOrder  = null;

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

  // Alcance: só bloqueia se for IMPOSSÍVEL atingir o mínimo com qualquer combinação
  if (erros.length === 0) {
    const sorted   = [...avail].sort((a,b) => b.reach - a.reach);
    const maxReach = sorted.slice(0, n).reduce((s,f) => s + f.reach, 0);
    if (maxReach < min) {
      erros.push(
        `Alcance insuficiente: o máximo possível com as facções disponíveis é ${maxReach}, mas o mínimo para ${n} jogadores é ${min}.`
      );
      erros.push('Habilite mais expansões ou reduza o número de jogadores.');
    }
    // Se maxReach >= min mas pode ser difícil sortear → deixa passar, aviso no resultado
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

  // Computa O mapeamento facção→jogador UMA única vez
  // (renderResult e criarPartida devem usar o MESMO embaralhamento)
  const shuffledNames = shuffle(names);
  const playerFaction = {};
  facResult.setupOrder.forEach((fac, i) => { playerFaction[fac.id] = shuffledNames[i]; });
  _lastSetupOrder = facResult.setupOrder.map(f => ({
    player: playerFaction[f.id],
    facId: f.id,
    facName: f.name,
    type: f.type,
    accent: f.accent,
  }));
  _lastTurnOrder = computeSorteioTurnOrder(_lastSetupOrder);

  renderResult(facResult, names, chosenMap, mapArr.length > 1, clearingResult, chosenDeck, playerFaction);
  criarPartida(facResult, playerFaction, chosenMap, chosenDeck);
  atualizarBadgePartida(true);
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.innerHTML = msg.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  el.style.display = 'block';
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function drawFactions(avail, n, minReach, preSelected = []) {
  const locked    = avail.filter(f => preSelected.includes(f.id));
  const pool      = avail.filter(f => !preSelected.includes(f.id));
  const remaining = n - locked.length;

  let fallback = null; // melhor combinação válida mesmo sem alcance suficiente

  for (let attempt = 0; attempt < 600; attempt++) {
    const candidate = [...locked, ...shuffle(pool).slice(0, remaining)];
    const hasMilitant = candidate.some(f => f.type==='militant');
    if (!hasMilitant && n >= 2) continue;
    const insCount = candidate.filter(f => f.type==='insurgent').length;
    if (minInsurgentes > 0 && insCount < minInsurgentes) continue;
    // Malandro 2 só pode entrar se o Malandro 1 também estiver no grupo
    const hasV2 = candidate.some(f => f.id === 'vagabond2');
    const hasV1 = candidate.some(f => f.id === 'vagabond');
    if (hasV2 && !hasV1) continue;

    const totalReach = candidate.reduce((s,f) => s+f.reach, 0);
    const mil = candidate.filter(f => f.type==='militant');
    const ins = candidate.filter(f => f.type==='insurgent');
    const result = {
      chosen: candidate,
      setupOrder: [...shuffle(mil), ...shuffle(ins)],
      turnOrder: shuffle(candidate),
      totalReach,
      reachWarning: totalReach < minReach,
    };

    if (!result.reachWarning) return result;      // alcance ok → retorna imediatamente
    if (!fallback) fallback = result;             // guarda o primeiro válido sem alcance
  }

  return fallback; // retorna mesmo sem alcance suficiente (aviso será exibido)
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

// ===================== MESA REDONDA =====================
function _renderMesaRedonda(containerId, seats, interactive) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const N = seats.length;
  const W  = N <= 4 ? 310 : 370;
  const R  = N <= 3 ? 100 : N <= 4 ? 112 : 132;
  const cx = W / 2, cy = W / 2;
  const SW = N >= 5 ? 88 : 98;
  const SH = 86;
  const TD = 90;

  el.innerHTML = '';
  el.style.cssText = `position:relative;width:${W}px;height:${W}px;margin:0 auto;`;

  // Centro da mesa
  const center = document.createElement('div');
  center.style.cssText = `position:absolute;width:${TD}px;height:${TD}px;border-radius:50%;`
    + `background:var(--surface);border:2px solid var(--border);`
    + `left:${cx-TD/2}px;top:${cy-TD/2}px;`
    + `display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;z-index:1;`;
  center.innerHTML = `<span style="font-size:1.3rem;line-height:1;">${interactive ? '↺' : '↻'}</span>`
    + `<span style="font-size:.56rem;color:var(--text3);font-family:sans-serif;text-align:center;line-height:1.3;">`
    + `${interactive ? 'Prep.<br>Anti-horária' : 'Turno<br>Horário'}</span>`;
  el.appendChild(center);

  let selectedIdx = null;

  seats.forEach((seat, i) => {
    const rad  = (-90 + 360 / N * i) * Math.PI / 180;
    const x    = cx + R * Math.cos(rad);
    const y    = cy + R * Math.sin(rad);
    const isFirst    = i === 0;
    const isClickable = interactive && !isFirst;
    const typeBg    = seat.type === 'militant' ? 'rgba(200,70,70,.85)' : 'rgba(50,150,80,.85)';
    const typeLabel = seat.type === 'militant' ? '⚔ Militante' : '◆ Insurgente';

    const div = document.createElement('div');
    div.style.cssText = `position:absolute;width:${SW}px;`
      + `left:${Math.round(x - SW/2)}px;top:${Math.round(y - SH/2)}px;`
      + `background:${isFirst ? 'rgba(218,165,32,.15)' : 'var(--surface2)'};`
      + `border:1.5px solid ${isFirst ? 'rgba(218,165,32,.65)' : 'var(--border)'};`
      + `border-radius:8px;padding:5px 5px 4px;text-align:center;box-sizing:border-box;z-index:2;`
      + `cursor:${isClickable ? 'pointer' : 'default'};transition:border-color .12s,background .12s,transform .1s;`;

    div.innerHTML = `<div style="font-size:.6rem;color:${isFirst ? 'var(--gold)' : 'var(--text3)'};font-family:sans-serif;margin-bottom:2px;">`
      + `${seat.num}°${isFirst && interactive ? ' 📍' : ''}</div>`
      + `<div style="font-family:sans-serif;font-size:.7rem;font-weight:700;color:var(--text1);`
      + `white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${SW-12}px;margin:0 auto 1px;">`
      + `${seat.player.toUpperCase()}</div>`
      + `<div style="font-family:sans-serif;font-size:.59rem;color:var(--gold);`
      + `white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${SW-12}px;margin:0 auto 2px;">`
      + `${seat.facName}</div>`
      + `<span style="display:inline-block;padding:1px 4px;border-radius:3px;font-size:.5rem;`
      + `font-family:sans-serif;background:${typeBg};color:#fff;">${typeLabel}</span>`
      + (seat.reach !== undefined
        ? `<div style="font-size:.52rem;color:var(--text3);font-family:sans-serif;margin-top:2px;">Alcance ${seat.reach}</div>`
        : '');

    if (isClickable) {
      div.addEventListener('mouseenter', () => { if (selectedIdx !== i) div.style.borderColor = 'rgba(218,165,32,.4)'; });
      div.addEventListener('mouseleave', () => {
        if (selectedIdx !== i) { div.style.borderColor = 'var(--border)'; div.style.background = 'var(--surface2)'; }
      });
      div.addEventListener('click', () => {
        if (selectedIdx === null) {
          selectedIdx = i;
          div.style.borderColor = 'var(--gold)';
          div.style.background   = 'rgba(218,165,32,.22)';
          div.style.transform    = 'scale(1.06)';
        } else if (selectedIdx === i) {
          selectedIdx = null;
          div.style.borderColor = 'var(--border)';
          div.style.background  = 'var(--surface2)';
          div.style.transform   = '';
        } else {
          const a = selectedIdx, b = i;
          selectedIdx = null;
          const newOrder = [..._lastSetupOrder];
          [newOrder[a], newOrder[b]] = [newOrder[b], newOrder[a]];
          updateSorteioSetupOrder(newOrder);
        }
      });
    }
    el.appendChild(div);
  });
}

// ===================== RENDER RESULTADO =====================
let _lastFacResult = null;
let _lastNames = null;
let _lastMap = null;
let _lastPlayerFaction = null;

function renderResult(facResult, names, chosenMap, wasDrawn, clearingResult, chosenDeck, playerFaction) {
  _lastFacResult = facResult;
  _lastNames = names;
  _lastMap = chosenMap;
  _lastPlayerFaction = playerFaction || {};
  _lastChosenMap = chosenMap;
  _lastWasDrawn = wasDrawn;
  _lastClearingResult = clearingResult;
  _lastChosenDeck = chosenDeck;
  const section = document.getElementById('resultSection');
  const cards = document.getElementById('resultCards');
  const summary = document.getElementById('summaryBox');
  const mapDiv = document.getElementById('resultMap');
  const clearDiv = document.getElementById('resultClearing');

  let subtitleParts = [names.length + ' jogadores', chosenMap.name, 'Alcance: ' + facResult.totalReach];
  if (chosenDeck) subtitleParts.push('🃏 ' + chosenDeck);
  document.getElementById('resultSubtitle').textContent = subtitleParts.join(' · ');

  // Usa o mapeamento já computado em sortear() — não embaralha de novo
  if (!playerFaction) return;

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

  // --- FACÇÕES (mesas redondas) ---
  cards.innerHTML = '';

  // Constrói/reutiliza setupOrder com reach incluso
  if (!Array.isArray(_lastSetupOrder) || _lastSetupOrder.length !== facResult.setupOrder.length) {
    _lastSetupOrder = facResult.setupOrder.map(f => ({
      player: playerFaction[f.id], facId: f.id, facName: f.name, type: f.type, accent: f.accent, reach: f.reach,
    }));
    _lastTurnOrder = computeSorteioTurnOrder(_lastSetupOrder);
  }
  const setupOrder = _lastSetupOrder;
  const turnOrder  = _lastTurnOrder || computeSorteioTurnOrder(setupOrder);
  const N = setupOrder.length;

  // ── Mesa de Preparação (anti-horária, interativa) ──
  cards.insertAdjacentHTML('beforeend', `
    <div class="divider-section" style="margin-top:2rem">
      <div class="divider-label">Ordem de Preparação</div>
      <hr class="divider-line">
    </div>
    <p class="sorteio-disclaimer">
      <strong>${setupOrder[0]?.player || '—'}</strong> prepara primeiro (fixo ↺).
      Clique em dois jogadores para trocar de posição na mesa.
    </p>
    <div id="mesaSetupWrap"></div>`);

  _renderMesaRedonda('mesaSetupWrap',
    setupOrder.map((item, i) => ({ player: item.player, facName: item.facName, type: item.type, reach: item.reach, num: i + 1 })),
    true);

  // ── Mesa de Turno (horária, exibição) ──
  cards.insertAdjacentHTML('beforeend', `
    <div class="divider-section" style="margin-top:2rem">
      <div class="divider-label">Ordem de Jogo (1º turno)</div>
      <hr class="divider-line">
    </div>
    <p class="sorteio-disclaimer">
      A ordem de turno é <strong>horária ↻</strong> — começa pelo último a preparar.
    </p>
    <div id="mesaTurnWrap"></div>`);

  // Mesmos assentos físicos, número de turno = N − i (inverso da preparação)
  _renderMesaRedonda('mesaTurnWrap',
    setupOrder.map((item, i) => ({ player: item.player, facName: item.facName, type: item.type, num: N - i })),
    false);

  // Resumo
  const minReach = REACH_MIN[names.length];
  const reachOk = facResult.totalReach >= minReach;

  // Breakdown de alcance: "Marqueses(10) + Malandro(2) + ... = 20 ✓"
  const reachBreakdown = facResult.setupOrder
    .map(f => `${f.name} <span style="color:var(--gold);font-weight:600;">(${f.reach})</span>`)
    .join(' + ') + ` = <strong>${facResult.totalReach}</strong> ${reachOk ? '✓' : '✗'}`;

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
    <div class="summary-row" style="align-items:flex-start;">
      <span class="summary-key" style="padding-top:2px;">Alcance</span>
      <span class="summary-val ${reachOk?'reach-ok':'reach-warn'}" style="text-align:right;font-size:0.78rem;line-height:1.5;">
        ${reachBreakdown}<br>
        <span style="font-size:0.7rem;opacity:0.75;">mínimo: ${minReach}</span>
      </span>
    </div>
    <div class="summary-row"><span class="summary-key">Militantes</span><span class="summary-val">${facResult.chosen.filter(f=>f.type==='militant').length}</span></div>
    <div class="summary-row"><span class="summary-key">Insurgentes</span><span class="summary-val">${facResult.chosen.filter(f=>f.type==='insurgent').length}</span></div>
    ${suitCounts}
    <div class="summary-row"><span class="summary-key">Facções</span>
      <span class="summary-val" style="font-size:0.82rem;text-align:right">${facResult.setupOrder.map(f=>f.name).join(', ')}</span>
    </div>`;

  // Aviso de alcance insuficiente (não bloqueia, apenas alerta)
  const warnBox = document.getElementById('reachWarnBox');
  if (warnBox) {
    if (facResult.reachWarning) {
      const minR = REACH_MIN[names.length];
      warnBox.style.display = 'block';
      warnBox.innerHTML = `<strong>⚠️ Alcance abaixo do mínimo</strong><br>
        Alcance total: <strong>${facResult.totalReach}</strong> — mínimo recomendado: <strong>${minR}</strong>.<br>
        O grupo pode gerar desequilíbrio. Considere habilitar mais expansões.`;
    } else {
      warnBox.style.display = 'none';
    }
  }

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

    // Usa a ordem física atual (pode ter sido ajustada pelo drag)
    const seating = (Array.isArray(_lastSetupOrder) && _lastSetupOrder.length)
      ? _lastSetupOrder
      : _lastFacResult.setupOrder.map(f => ({
          facId: f.id, player: (_lastPlayerFaction && _lastPlayerFaction[f.id]) || '',
        }));

    seating.forEach((item, i) => {
      const playerName = item.player || (_lastPlayerFaction && _lastPlayerFaction[item.facId]) || _lastNames[i] || '';
      const facId      = item.facId === 'vagabond2' ? 'vagabond2' : (item.facId || '');

      const nameEl = document.getElementById('ligaName_' + i);
      const facEl  = document.getElementById('ligaFac_' + i);
      if (nameEl) nameEl.value = playerName;
      if (facEl)  { facEl.value = facId; onFacChange(i); }
    });
    updateFacSelects();

    document.getElementById('tab-liga').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

function resetar() { sortear(); }