// Partida em andamento

let partidaAtual = null;
let timerInterval = null;
let estadoPartida = 'ativo'; // 'ativo' | 'formulario' | 'resultado'
let resultadoGerado = null;

// ── Criar / Restaurar ────────────────────────────────────────────────────────

function criarPartida(facResult, nomes, mapa, deck) {
  const jogadores = facResult.setupOrder.map((fac, i) => ({
    nome: nomes[i] || `Jogador ${i + 1}`,
    faccao: fac.name,
    faccaoId: fac.id,
    tipo: fac.type,
  }));

  const turnOrder = facResult.turnOrder.map(fac => {
    const idx = facResult.setupOrder.indexOf(fac);
    return idx >= 0 ? (nomes[idx] || `Jogador ${idx + 1}`) : fac.name;
  });

  partidaAtual = {
    jogadores,
    mapa: mapa.name,
    mapaIcon: mapa.icon,
    deck: deck || null,
    turnOrder,
    inicio: new Date().toISOString(),
  };

  estadoPartida = 'ativo';
  resultadoGerado = null;
  localStorage.setItem('partidaAtual', JSON.stringify(partidaAtual));

  if (document.getElementById('tab-partida')?.classList.contains('active')) {
    renderPartida();
  }
}

function restaurarPartidaSeExistir() {
  const saved = localStorage.getItem('partidaAtual');
  if (!saved) return;
  try {
    partidaAtual = JSON.parse(saved);
    estadoPartida = 'ativo';
    atualizarBadgePartida(true);
  } catch (e) {
    localStorage.removeItem('partidaAtual');
  }
}

// ── Finalizar (chamado da aba Liga) ─────────────────────────────────────────

function finalizarPartida(jogadoresFinais) {
  const local = document.getElementById('ligaLocal')?.value?.trim() || '';
  const dataVal = document.getElementById('ligaData')?.value || '';
  const mapaForm = document.getElementById('ligaMapa')?.value || '';

  const resultado = {
    local,
    data: dataVal,
    mapa: mapaForm || (partidaAtual?.mapa || ''),
    jogadores: jogadoresFinais,
    criadoEm: new Date().toISOString(),
  };

  if (typeof currentUser !== 'undefined' && currentUser) {
    salvarHistoricoSupabase(resultado);
  }

  localStorage.removeItem('partidaAtual');
  partidaAtual = null;
  estadoPartida = 'ativo';
  atualizarBadgePartida(false);
  stopTimer();
  renderPartida();
}

// ── Salvar no Supabase ───────────────────────────────────────────────────────

async function salvarHistoricoSupabase(resultado) {
  try {
    const sb = await initSupabase();
    await sb.from('historico').insert({
      user_id: currentUser.id,
      dados: resultado,
      criado_em: resultado.criadoEm,
    });
    if (typeof carregarHistorico === 'function') {
      if (document.getElementById('tab-historico')?.classList.contains('active')) {
        carregarHistorico();
      }
    }
  } catch (e) {
    console.warn('Erro ao salvar histórico:', e);
  }
}

// ── Timer ────────────────────────────────────────────────────────────────────

function startTimer() {
  stopTimer();
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer();
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimer() {
  const el = document.getElementById('partidaTimer');
  if (!el || !partidaAtual) { stopTimer(); return; }
  const ms = Date.now() - new Date(partidaAtual.inicio).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  el.textContent = h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
    : `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// ── Badge ────────────────────────────────────────────────────────────────────

function atualizarBadgePartida(ativa) {
  const btn = document.querySelector('.liga-tab[data-tab="partida"]');
  if (!btn) return;
  let badge = btn.querySelector('.tab-badge');
  if (ativa) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tab-badge';
      btn.appendChild(badge);
    }
  } else {
    if (badge) badge.remove();
  }
}

// ── Render principal ─────────────────────────────────────────────────────────

function renderPartida() {
  const section = document.getElementById('tab-partida');
  if (!section) return;

  if (!partidaAtual && estadoPartida !== 'resultado') {
    stopTimer();
    section.innerHTML = `
      <div class="section" style="text-align:center;padding:2.5rem 2rem;">
        <div style="font-size:2.5rem;margin-bottom:1rem;">🎮</div>
        <div style="font-size:1rem;color:var(--text2);font-family:sans-serif;">Nenhuma partida em andamento</div>
        <div style="font-size:0.82rem;color:var(--text3);font-family:sans-serif;margin-top:0.5rem;line-height:1.5;">
          Faça um sorteio na aba ⚔ Sorteio para começar.
        </div>
      </div>`;
    return;
  }

  if (estadoPartida === 'formulario') {
    stopTimer();
    renderFormularioResultado(section);
    return;
  }

  if (estadoPartida === 'resultado') {
    stopTimer();
    renderResultadoPartida(section);
    return;
  }

  // Estado: ativo
  renderPartidaAtiva(section);
  startTimer();
}

// ── Partida ativa (com timer) ─────────────────────────────────────────────────

function renderPartidaAtiva(section) {
  const { jogadores, mapa, mapaIcon, deck, turnOrder } = partidaAtual;

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Partida em Andamento</div>

      <div class="partida-header-row">
        <div style="display:flex;align-items:center;gap:10px;">
          ${mapaIcon ? `<span style="font-size:1.6rem;line-height:1;">${mapaIcon}</span>` : ''}
          <div>
            <div style="font-size:0.95rem;color:var(--text);">${mapa}</div>
            ${deck ? `<div style="font-size:0.75rem;color:var(--text3);font-family:sans-serif;">🃏 ${deck}</div>` : ''}
          </div>
        </div>
        <div class="partida-timer-box">
          <div style="font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text3);font-family:sans-serif;margin-bottom:2px;">Em andamento</div>
          <div id="partidaTimer" style="font-size:1.4rem;color:var(--gold-light);font-family:'Courier New',monospace;font-weight:bold;letter-spacing:0.05em;">00m 00s</div>
        </div>
      </div>

      <div class="section-title" style="margin-top:1.25rem;">Ordem de Setup</div>
      ${jogadores.map((j, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;background:var(--surface2);">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--surface);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:0.78rem;color:var(--text3);font-family:sans-serif;flex-shrink:0;font-weight:bold;">${i + 1}</div>
          <div style="flex:1;">
            <div style="font-size:0.9rem;color:var(--text);">${j.nome}</div>
            <div style="font-size:0.75rem;font-family:sans-serif;">
              <span style="color:var(--text3);">${j.faccao}</span>
              <span style="margin-left:6px;padding:1px 6px;border-radius:10px;font-size:0.68rem;background:${j.tipo === 'militant' ? 'rgba(200,64,40,0.15)' : 'rgba(74,143,48,0.15)'};color:${j.tipo === 'militant' ? '#f09080' : '#80d060'};">${j.tipo === 'militant' ? 'Militante' : 'Insurgente'}</span>
            </div>
          </div>
        </div>
      `).join('')}

      ${turnOrder && turnOrder.length > 0 ? `
        <div class="section-title" style="margin-top:1.25rem;">Ordem de Turno</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${turnOrder.map((nome, i) => `
            <div style="padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;font-size:0.82rem;font-family:sans-serif;color:var(--text2);">${i + 1}. ${nome}</div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <button class="btn-sortear" onclick="abrirFormularioResultado()" style="margin-top:0.5rem;">
      🏁 Encerrar e registrar resultado
    </button>
    <button class="btn-resetar" onclick="descartarPartida()" style="color:#f09080;border-color:rgba(200,64,40,0.25);">
      ✕ Descartar partida
    </button>`;
}

// ── Formulário de resultado ───────────────────────────────────────────────────

function abrirFormularioResultado() {
  estadoPartida = 'formulario';
  renderPartida();
}

function renderFormularioResultado(section) {
  const { jogadores, mapa } = partidaAtual;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const mapaOptions = [
    { val: '', label: '— Selecione o mapa —' },
    { val: 'Outono', label: '🍂 Outono' },
    { val: 'Inverno', label: '❄️ Inverno' },
    { val: 'Lago', label: '🌊 Lago' },
    { val: 'Montanha', label: '⛰️ Montanha' },
  ];

  const mapaAtual = mapaOptions.find(m => m.label.includes(mapa))?.val || '';

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Registrar Resultado</div>

      <div class="liga-field-row">
        <div class="liga-field">
          <label>Local da Partida</label>
          <input type="text" id="pLocal" placeholder="Ex: Casa do Felipe">
        </div>
        <div class="liga-field">
          <label>Data</label>
          <input type="date" id="pData" value="${todayStr}">
        </div>
      </div>
      <div class="liga-field-row" style="margin-bottom:0;">
        <div class="liga-field">
          <label>Mapa utilizado</label>
          <select id="pMapa">
            ${mapaOptions.map(m => `<option value="${m.val}"${m.val === mapaAtual ? ' selected' : ''}>${m.label}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Jogadores e Pontuações</div>
      ${jogadores.map((j, i) => `
        <div class="liga-player-card" style="margin-bottom:10px;">
          <div class="liga-player-header">${j.nome} — <span style="color:var(--text2);text-transform:none;letter-spacing:0;">${j.faccao}</span></div>
          <div class="liga-field-row">
            <div class="liga-field">
              <label>Pontuação</label>
              <input type="number" id="pScore_${i}" min="0" max="99" placeholder="0" oninput="onPScoreInput(${i})">
            </div>
            <div class="liga-field" style="justify-content:flex-end;padding-top:18px;">
              <div class="liga-checks">
                <label class="liga-check"><input type="checkbox" id="pIniciante_${i}"> Iniciante</label>
                <label class="liga-check"><input type="checkbox" id="pVitDom_${i}" onchange="onPVitDom(${i},this)"> Vitória por domínio</label>
                <label class="liga-check"><input type="checkbox" id="pDerDom_${i}" onchange="onPDerDom(${i},this)"> Derrota por domínio</label>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div id="pErroMsg" style="display:none;background:var(--red-bg);border:1px solid rgba(200,64,40,0.3);border-radius:var(--radius);padding:0.75rem 1rem;color:#f09080;font-family:sans-serif;font-size:0.85rem;margin-bottom:1rem;white-space:pre-line;"></div>

    <button class="btn-sortear" onclick="gerarResultadoPartida()">📋 Gerar e salvar resultado</button>
    <button class="btn-resetar" onclick="voltarParaPartidaAtiva()">← Voltar</button>`;
}

function voltarParaPartidaAtiva() {
  estadoPartida = 'ativo';
  renderPartida();
}

function onPVitDom(i, cb) {
  if (cb.checked) {
    const der = document.getElementById(`pDerDom_${i}`);
    if (der) der.checked = false;
    const score = document.getElementById(`pScore_${i}`);
    if (score) score.disabled = true;
  } else {
    const score = document.getElementById(`pScore_${i}`);
    if (score) score.disabled = false;
  }
}

function onPDerDom(i, cb) {
  if (cb.checked) {
    const vit = document.getElementById(`pVitDom_${i}`);
    if (vit) vit.checked = false;
    const score = document.getElementById(`pScore_${i}`);
    if (score) score.disabled = true;
  } else {
    const score = document.getElementById(`pScore_${i}`);
    if (score) score.disabled = false;
  }
}

function onPScoreInput(i) {
  const score = document.getElementById(`pScore_${i}`);
  if (score && score.value !== '') {
    const vit = document.getElementById(`pVitDom_${i}`);
    const der = document.getElementById(`pDerDom_${i}`);
    if (vit) vit.checked = false;
    if (der) der.checked = false;
  }
}

// ── Gerar resultado ──────────────────────────────────────────────────────────

function gerarResultadoPartida() {
  const local = document.getElementById('pLocal').value.trim();
  const dataVal = document.getElementById('pData').value;
  const mapa = document.getElementById('pMapa').value;

  const erros = [];
  if (!local) erros.push('• Local da partida não preenchido');

  const players = [];
  for (let i = 0; i < partidaAtual.jogadores.length; i++) {
    const j = partidaAtual.jogadores[i];
    const scoreEl = document.getElementById(`pScore_${i}`);
    const scoreVal = scoreEl ? scoreEl.value.trim() : '';
    const vitDom = document.getElementById(`pVitDom_${i}`)?.checked || false;
    const derDom = document.getElementById(`pDerDom_${i}`)?.checked || false;
    const iniciante = document.getElementById(`pIniciante_${i}`)?.checked || false;

    if (!vitDom && !derDom && scoreVal === '') {
      erros.push(`• ${j.nome}: pontuação não preenchida`);
    }

    players.push({
      nome: j.nome,
      faccao: j.faccao,
      score: parseInt(scoreVal) || 0,
      vitDom,
      derDom,
      derDomFlag: derDom,
      iniciante,
    });
  }

  if (erros.length > 0) {
    const el = document.getElementById('pErroMsg');
    if (el) { el.textContent = erros.join('\n'); el.style.display = 'block'; }
    return;
  }

  // Ordenar: derrota por domínio vai por último, resto por pontuação desc
  const normal = players.filter(p => !p.derDomFlag);
  const derDoms = players.filter(p => p.derDomFlag);
  normal.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.vitDom && !b.vitDom) return -1;
    if (b.vitDom && !a.vitDom) return 1;
    return 0;
  });
  const sorted = [...normal, ...derDoms];

  // Formatar data
  let dataStr = '';
  if (dataVal) {
    const parts = dataVal.split('-');
    dataStr = `${parts[2]}/${parts[1]}`;
  }

  let header = local + (dataStr ? ' ' + dataStr : '');
  if (mapa) header += ' | Mapa ' + mapa;

  const lines = [header];
  sorted.forEach(p => {
    let line = p.nome;
    if (p.iniciante) line += ' (Iniciante)';
    line += ' - ' + p.faccao;
    if (p.vitDom) line += ' Vitória por Domínio';
    else if (p.derDomFlag) line += ' Derrota por Domínio';
    else line += ' ' + p.score;
    lines.push(line);
  });

  const textoResultado = lines.join('\n');

  const jogadoresFinais = sorted.map((p, i) => ({
    nome: p.nome,
    faccao: p.faccao,
    pontuacao: p.vitDom || p.derDomFlag ? null : p.score,
    vencedor: i === 0 && !p.derDomFlag,
    iniciante: p.iniciante,
  }));

  // Salvar
  const resultado = {
    local,
    data: dataVal,
    mapa,
    jogadores: jogadoresFinais,
    criadoEm: new Date().toISOString(),
  };

  if (typeof currentUser !== 'undefined' && currentUser) {
    salvarHistoricoSupabase(resultado);
  }

  localStorage.removeItem('partidaAtual');
  resultadoGerado = { texto: textoResultado, jogadores: jogadoresFinais };
  partidaAtual = null;
  estadoPartida = 'resultado';
  atualizarBadgePartida(false);
  if (typeof sbIncrement === 'function') sbIncrement('liga');

  const section = document.getElementById('tab-partida');
  if (section) renderResultadoPartida(section);

  // Ludopedia — botão registrar
  if (typeof mostrarBotaoLudo === 'function') {
    // Passa resultado para mostrar após o render (o container só existe depois do render)
    setTimeout(() => mostrarBotaoLudo(resultado, 'ludoBtnContainerPartida'), 50);
  }
}

// ── Exibir resultado ─────────────────────────────────────────────────────────

function renderResultadoPartida(section) {
  if (!resultadoGerado) { estadoPartida = 'ativo'; renderPartida(); return; }

  const { texto } = resultadoGerado;

  section.innerHTML = `
    <div class="liga-result-box" style="display:block;">
      <div class="liga-result-header">
        <span>Resultado da Partida</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn-copiar" id="pBtnCopiar" onclick="copiarResultadoPartida()">📋 Copiar</button>
          <button class="btn-copiar" onclick="compartilharWhatsAppPartida()" style="background:#25D366;color:white;">📲 WhatsApp</button>
        </div>
      </div>
      <div class="liga-result-text" id="pResultText">${texto}</div>
    </div>
    <div id="ludoBtnContainerPartida"></div>

    <button class="btn-sortear" onclick="novaPartida()" style="margin-top:1rem;">⚔ Novo sorteio</button>
    <button class="btn-resetar" onclick="irParaHistorico()">📋 Ver histórico completo</button>`;
}

function copiarResultadoPartida() {
  const text = document.getElementById('pResultText')?.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('pBtnCopiar');
    if (btn) {
      btn.textContent = '✓ Copiado!';
      btn.className = 'btn-copiar copied';
      setTimeout(() => { btn.textContent = '📋 Copiar'; btn.className = 'btn-copiar'; }, 2000);
    }
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

function compartilharWhatsAppPartida() {
  const text = document.getElementById('pResultText')?.textContent || '';
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

function novaPartida() {
  resultadoGerado = null;
  estadoPartida = 'ativo';
  renderPartida();
  // Ir para aba sorteio
  const btn = document.querySelector('.liga-tab[data-tab="sorteio"]');
  if (btn) switchTab('sorteio', btn);
}

function irParaHistorico() {
  resultadoGerado = null;
  estadoPartida = 'ativo';
  const btn = document.querySelector('.liga-tab[data-tab="historico"]');
  if (btn) switchTab('historico', btn);
}

function descartarPartida() {
  if (!confirm('Descartar a partida sem salvar?')) return;
  localStorage.removeItem('partidaAtual');
  partidaAtual = null;
  estadoPartida = 'ativo';
  atualizarBadgePartida(false);
  stopTimer();
  renderPartida();
}
