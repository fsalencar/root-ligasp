// ===================== CADASTRO DE JOGADORES =====================

let _jogadoresCadastrados = [];
// Por slot de sorteio: { ludopedia_id, ludopedia_usuario, jogador_id }
const _playerLudoSlot = {};
// Dados encontrados via ID/QR aguardando confirmação de nome por slot
const _pendingSlotData = {};

// ── CRUD Supabase ─────────────────────────────────────────────────────────────

async function carregarJogadoresCadastrados() {
  if (typeof currentUser === 'undefined' || !currentUser) { _jogadoresCadastrados = []; return []; }
  try {
    const sb = await initSupabase();
    const { data } = await sb.from('jogadores').select('*').eq('user_id', currentUser.id).order('nome');
    _jogadoresCadastrados = data || [];
  } catch (e) { _jogadoresCadastrados = []; }
  return _jogadoresCadastrados;
}

async function _salvarJogadorNoBanco({ id, nome, ludopedia_usuario, ludopedia_id }) {
  const sb = await initSupabase();
  if (id) {
    const { error } = await sb.from('jogadores')
      .update({ nome, ludopedia_usuario: ludopedia_usuario || null, ludopedia_id: ludopedia_id || null })
      .eq('id', id).eq('user_id', currentUser.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('jogadores')
      .insert({ user_id: currentUser.id, nome, ludopedia_usuario: ludopedia_usuario || null, ludopedia_id: ludopedia_id || null });
    if (error) throw error;
  }
  await carregarJogadoresCadastrados();
}

async function _removerJogadorDoBanco(id) {
  const sb = await initSupabase();
  await sb.from('jogadores').delete().eq('id', id).eq('user_id', currentUser.id);
  await carregarJogadoresCadastrados();
}

// ── Dados por slot ─────────────────────────────────────────────────────────────

// Flag: só auto-preenche UMA vez por sessão de login
// Evita re-preencher quando o Supabase dispara SIGNED_IN no refresh de token
let _slotProprioJaPreenchido = false;

function resetSlotProprio() { _slotProprioJaPreenchido = false; }

// Auto-preenche o primeiro slot vazio com o usuário logado
function preencherSlotProprio() {
  if (_slotProprioJaPreenchido) return;
  if (typeof currentUser === 'undefined' || !currentUser) return;
  if (typeof numPlayers === 'undefined' || numPlayers === 0) return;

  const nomeUser = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '';
  const ludoNome = (typeof ludoUser !== 'undefined') ? (ludoUser?.usuario || ludoUser?.nm_usuario || '') : '';
  const ludoId   = (typeof ludoUser !== 'undefined') ? ludoUser?.id_usuario : null;

  // Se o grid ainda não foi renderizado, agenda para daqui a pouco
  if (!document.getElementById('playerName_0')) {
    setTimeout(preencherSlotProprio, 300);
    return;
  }

  // Preenche o primeiro slot vazio
  for (let i = 0; i < numPlayers; i++) {
    const inp = document.getElementById('playerName_' + i);
    if (!inp || inp.value.trim()) continue;

    inp.value = nomeUser || ludoNome;
    if (ludoId) {
      _playerLudoSlot[i] = { ludopedia_id: ludoId, ludopedia_usuario: ludoNome };
      _refreshSlotBadge(i);
    }
    _slotProprioJaPreenchido = true;
    break;
  }

  // Marca como preenchido mesmo que todos os slots já estivessem ocupados
  _slotProprioJaPreenchido = true;
}

function getLudoDataParaSlot(i) {
  return _playerLudoSlot[i] || null;
}

function limparSlotLudo(i) {
  delete _playerLudoSlot[i];
  _refreshSlotBadge(i);
}

function _setSlotJogador(slotIdx, jogador) {
  // Preenche o input de nome
  const inp = document.getElementById('playerName_' + slotIdx);
  if (inp) inp.value = jogador.nome;
  // Guarda dados Ludopedia do slot
  if (jogador.ludopedia_id) {
    _playerLudoSlot[slotIdx] = { ludopedia_id: jogador.ludopedia_id, ludopedia_usuario: jogador.ludopedia_usuario };
  } else {
    delete _playerLudoSlot[slotIdx];
  }
  _refreshSlotBadge(slotIdx);
}

function _refreshSlotBadge(i) {
  const el = document.getElementById('playerSlotBadge_' + i);
  if (!el) return;
  const ludo = _playerLudoSlot[i];
  if (ludo?.ludopedia_usuario || ludo?.ludopedia_id) {
    const title = ludo.ludopedia_usuario ? `🎲 ${ludo.ludopedia_usuario}` : '🎲 Ludopedia';
    const idLine = ludo.ludopedia_id ? `<div class="slot-badge-ludo-id">ID: ${ludo.ludopedia_id}</div>` : '';
    el.innerHTML = `
      <div class="slot-badge-ludo">
        <span>${title}</span>
        <button type="button" class="slot-badge-remove" onclick="limparSlotLudo(${i})" title="Remover vínculo Ludopedia">×</button>
      </div>
      ${idLine}`;
  } else {
    el.innerHTML = '';
  }
}

function _refreshAllSlotBadges() {
  const n = typeof numPlayers !== 'undefined' ? numPlayers : 0;
  for (let i = 0; i < n; i++) _refreshSlotBadge(i);
}

// ── Painel por slot ("+") ─────────────────────────────────────────────────────

let _painelSlotAtivo = null;

function abrirPainelSlot(slotIdx) {
  _fecharPainelSlot();

  const inp = document.getElementById('playerName_' + slotIdx);
  if (!inp) return;

  const painel = document.createElement('div');
  painel.className = 'slot-painel';
  painel.id = 'slotPainel_' + slotIdx;
  painel.innerHTML = _renderConteudoPainel(slotIdx);
  inp.parentElement.insertBefore(painel, inp.nextSibling.nextSibling); // after badge div
  _painelSlotAtivo = slotIdx;

  // Fecha ao clicar fora
  setTimeout(() => document.addEventListener('click', _clickForaPainel, true), 50);
}

function _fecharPainelSlot() {
  if (_painelSlotAtivo !== null) {
    const el = document.getElementById('slotPainel_' + _painelSlotAtivo);
    if (el) el.remove();
    _painelSlotAtivo = null;
    document.removeEventListener('click', _clickForaPainel, true);
  }
}

function _clickForaPainel(e) {
  const painel = document.querySelector('.slot-painel');
  if (painel && !painel.contains(e.target)) _fecharPainelSlot();
}

function _renderConteudoPainel(slotIdx) {
  const temCadastrado = _jogadoresCadastrados.length > 0;
  const logado = typeof currentUser !== 'undefined' && currentUser;

  const listaHtml = temCadastrado ? `
    <div style="font-size:0.72rem;color:var(--text3);font-family:sans-serif;margin-bottom:4px;letter-spacing:0.04em;">JOGADORES CADASTRADOS</div>
    <input type="text" placeholder="Pesquisar..." class="slot-painel-search"
      oninput="_filtrarPainelSlot(${slotIdx}, this.value)" style="margin-bottom:6px;">
    <div id="slotPainelLista_${slotIdx}" class="slot-painel-lista">
      ${_renderListaPainel(slotIdx, _jogadoresCadastrados)}
    </div>` : (!logado ? `
    <div style="font-size:0.75rem;color:var(--text3);font-family:sans-serif;text-align:center;padding:0.5rem 0;">
      Faça login para usar jogadores cadastrados.
    </div>` : `
    <div style="font-size:0.75rem;color:var(--text3);font-family:sans-serif;text-align:center;padding:0.5rem 0;">
      Nenhum jogador cadastrado ainda.
    </div>`);

  return `
    ${listaHtml}
    <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:8px;display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:0.72rem;color:var(--text3);font-family:sans-serif;letter-spacing:0.04em;">ADICIONAR POR ID / QR CODE</div>
      <div style="display:flex;gap:6px;">
        <input type="text" id="slotIdInput_${slotIdx}" placeholder="ID do jogador" style="flex:1;font-size:0.8rem;padding:0.3rem 0.5rem;">
        <button class="ludo-btn-sm" onclick="_adicionarPorId(${slotIdx})">OK</button>
        <button class="ludo-btn-sm" title="Escanear QR" onclick="_abrirScannerQR(${slotIdx})">📷</button>
      </div>
      <div id="slotIdStatus_${slotIdx}" style="font-size:0.72rem;min-height:14px;font-family:sans-serif;"></div>
    </div>
    ${logado ? `
    <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:8px;">
      <button class="ludo-btn-sm" style="width:100%;" onclick="_fecharPainelSlot();_abrirFormNovoJogador(${slotIdx})">+ Cadastrar novo jogador</button>
    </div>` : ''}`;
}

function _renderListaPainel(slotIdx, lista) {
  return lista.map(j => `
    <div class="slot-painel-item" onclick="_selecionarJogadorSlot(${slotIdx},'${j.id}')">
      <div style="flex:1;min-width:0;">
        <div style="font-family:sans-serif;font-size:0.85rem;color:var(--text2);">${j.nome}</div>
        ${j.ludopedia_usuario ? `<div style="font-family:sans-serif;font-size:0.7rem;color:#80d060;">🎲 ${j.ludopedia_usuario}</div>` : ''}
      </div>
      <span style="font-size:0.7rem;color:var(--text3);font-family:sans-serif;">Selecionar</span>
    </div>`).join('');
}

function _filtrarPainelSlot(slotIdx, q) {
  const lista = q
    ? _jogadoresCadastrados.filter(j => j.nome.toLowerCase().includes(q.toLowerCase()))
    : _jogadoresCadastrados;
  const el = document.getElementById('slotPainelLista_' + slotIdx);
  if (el) el.innerHTML = _renderListaPainel(slotIdx, lista);
}

function _selecionarJogadorSlot(slotIdx, jogadorId) {
  const j = _jogadoresCadastrados.find(x => x.id === jogadorId);
  if (!j) return;
  // Define o jogador e fecha — o usuário pode editar o nome no input sem perder o link Ludopedia
  _setSlotJogador(slotIdx, j);
  _fecharPainelSlot();
}

// ── Adicionar por ID ──────────────────────────────────────────────────────────

async function _adicionarPorId(slotIdx) {
  const idInput = document.getElementById('slotIdInput_' + slotIdx);
  const statusEl = document.getElementById('slotIdStatus_' + slotIdx);
  const idVal = idInput?.value?.trim();
  if (!idVal || !statusEl) return;

  // Procura primeiro nos já carregados
  const local = _jogadoresCadastrados.find(j => j.id === idVal);
  if (local) {
    _mostrarConfirmacaoNome(slotIdx, local.nome, local.ludopedia_id, local.ludopedia_usuario, statusEl);
    return;
  }

  // Busca via server (pode ser UUID de usuário do app)
  statusEl.style.color = 'var(--text3)';
  statusEl.textContent = 'Buscando...';
  try {
    const res  = await fetch('/api/lookup-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: idVal }) });
    const data = await res.json();
    if (res.ok && data.found) {
      _mostrarConfirmacaoNome(slotIdx, data.nome, data.ludopedia_id, data.ludopedia_usuario, statusEl);
      return;
    }
    statusEl.style.color = '#f09080';
    statusEl.textContent = 'ID não encontrado.';
  } catch (e) {
    statusEl.style.color = '#f09080';
    statusEl.textContent = 'Erro: ' + e.message;
  }
}

function _mostrarConfirmacaoNome(slotIdx, nomeEncontrado, ludoId, ludoUsuario, statusEl) {
  // Guarda dados Ludopedia pendentes para este slot
  _pendingSlotData[slotIdx] = { ludopedia_id: ludoId || null, ludopedia_usuario: ludoUsuario || null };

  statusEl.innerHTML = `
    <div style="margin-top:4px;">
      <div style="font-family:sans-serif;font-size:0.7rem;color:#80d060;margin-bottom:4px;">
        ✓ Encontrado${ludoUsuario ? ': 🎲 ' + ludoUsuario : ''}
      </div>
      <label style="font-family:sans-serif;font-size:0.7rem;color:var(--text3);display:block;margin-bottom:3px;">Nome na liga:</label>
      <div style="display:flex;gap:4px;">
        <input id="slotConfirmNome_${slotIdx}" type="text" value="${nomeEncontrado}"
          style="flex:1;font-size:0.8rem;padding:0.25rem 0.45rem;"
          onkeydown="if(event.key==='Enter')_confirmarNomeSlot(${slotIdx})">
        <button class="ludo-btn-sm" style="background:rgba(74,143,48,0.2);border-color:rgba(74,143,48,0.4);color:#80d060;" onclick="_confirmarNomeSlot(${slotIdx})">✓</button>
      </div>
    </div>`;

  setTimeout(() => {
    const inp = document.getElementById('slotConfirmNome_' + slotIdx);
    if (inp) { inp.select(); }
  }, 50);
}

function _confirmarNomeSlot(slotIdx) {
  const inp  = document.getElementById('slotConfirmNome_' + slotIdx);
  const nome = inp?.value?.trim();
  if (!nome) return;
  const ludo = _pendingSlotData[slotIdx] || {};
  delete _pendingSlotData[slotIdx];
  _setSlotJogador(slotIdx, { nome, ...ludo });
  _fecharPainelSlot();
}

// ── Scanner QR ────────────────────────────────────────────────────────────────

async function _abrirScannerQR(slotIdx) {
  _fecharPainelSlot();
  const modal = document.getElementById('modalJogadores');
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:360px;width:95%;">
      <div class="modal-header">
        <span style="font-size:0.95rem;font-weight:600;color:var(--gold);">📷 Escanear QR Code</span>
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>
      <p style="font-family:sans-serif;font-size:0.8rem;color:var(--text3);margin-bottom:0.75rem;">
        Aponte para o QR Code do jogador.
      </p>
      <video id="qrVideo" style="width:100%;border-radius:var(--radius);background:#000;" playsinline></video>
      <canvas id="qrCanvas" style="display:none;"></canvas>
      <div id="qrStatus" style="font-family:sans-serif;font-size:0.78rem;color:var(--text3);margin-top:8px;text-align:center;">Iniciando câmera...</div>
      <button class="ludo-btn-sm" style="width:100%;margin-top:0.75rem;" onclick="_pararScannerQR()">Cancelar</button>
    </div>`;
  _iniciarScannerQR(slotIdx);
}

let _qrStream = null;
let _qrAnimFrame = null;

async function _iniciarScannerQR(slotIdx) {
  // Carrega jsQR dinamicamente
  if (!window.jsQR) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    } catch { document.getElementById('qrStatus').textContent = 'Erro ao carregar scanner.'; return; }
  }

  try {
    _qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('qrVideo');
    if (!video) return;
    video.srcObject = _qrStream;
    await video.play();

    const canvas = document.getElementById('qrCanvas');
    const ctx = canvas.getContext('2d');
    document.getElementById('qrStatus').textContent = 'Buscando QR Code...';

    function scan() {
      if (!document.getElementById('qrVideo')) { _pararScannerQR(); return; }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height);
      if (code?.data) {
        _pararScannerQR();
        fecharGerenciarJogadores();
        // O QR pode ter um UUID direto ou uma URL com ?pid=
        const match = code.data.match(/pid=([a-f0-9-]{36})|^([a-f0-9-]{36})$/i);
        const id = match ? (match[1] || match[2]) : code.data.trim();
        // Reabre o painel do slot e dispara lookup com confirmação de nome
        abrirPainelSlot(slotIdx);
        const inp = document.getElementById('slotIdInput_' + slotIdx);
        if (inp) { inp.value = id; _adicionarPorId(slotIdx); }
        return;
      }
      _qrAnimFrame = requestAnimationFrame(scan);
    }
    _qrAnimFrame = requestAnimationFrame(scan);
  } catch {
    document.getElementById('qrStatus').textContent = 'Câmera não disponível.';
  }
}

function _pararScannerQR() {
  if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
  if (_qrAnimFrame) { cancelAnimationFrame(_qrAnimFrame); _qrAnimFrame = null; }
}

function _abrirInputIdExterno(slotIdx, valor) {
  // Se o painel não está aberto, abre e retorna o input
  abrirPainelSlot(slotIdx);
  const inp = document.getElementById('slotIdInput_' + slotIdx);
  if (inp && valor) inp.value = valor;
  return inp;
}

// ── Modal principal: lista + gerenciamento ────────────────────────────────────

function abrirSelecionarJogadoresModal() {
  const modal = document.getElementById('modalJogadores');
  if (!modal) return;
  modal.style.display = 'flex';
  _renderTelaGerenciar();
}

function fecharGerenciarJogadores() {
  _pararScannerQR();
  const modal = document.getElementById('modalJogadores');
  if (modal) modal.style.display = 'none';
}

function _renderTelaGerenciar() {
  const modal = document.getElementById('modalJogadores');
  const lista = _jogadoresCadastrados;

  modal.innerHTML = `
    <div class="modal-box" style="max-width:440px;width:95%;max-height:90vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <span style="font-size:1rem;font-weight:600;color:var(--gold);">👥 Jogadores</span>
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>

      <div id="listaJogadoresModal" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;min-height:60px;margin-bottom:0.75rem;">
        ${lista.length ? lista.map(j => _renderCardGerenciar(j)).join('') : `
          <div style="text-align:center;padding:1.5rem;font-family:sans-serif;color:var(--text3);font-size:0.82rem;">
            Nenhum jogador cadastrado.<br>Clique em "+ Novo" para adicionar.
          </div>`}
      </div>

      <div style="border-top:1px solid var(--border);padding-top:0.75rem;">
        <button class="btn-liga" style="width:100%;" onclick="_abrirFormNovoJogador(null)">+ Novo jogador</button>
      </div>
    </div>`;
}

function _renderCardGerenciar(j) {
  const shortId = j.id.slice(0, 8);
  return `
    <div class="jogador-sel-item" style="cursor:default;">
      <div style="flex:1;min-width:0;">
        <div class="jsel-nome">${j.nome}</div>
        <div class="jsel-sub" style="opacity:.5;font-size:0.65rem;">ID: ${shortId}…</div>
        ${j.ludopedia_usuario ? `<div class="jsel-sub">🎲 ${j.ludopedia_usuario}</div>` : ''}
      </div>
      <button class="ludo-btn-sm" onclick="_mostrarQRJogador('${j.id}','${j.nome.replace(/'/g,"\\'")}')" title="QR Code">QR</button>
      <button class="jsel-edit-btn" onclick="_abrirFormEditarJogador('${j.id}')" title="Editar">✏️</button>
    </div>`;
}

async function _mostrarQRJogador(id, nome) {
  const modal = document.getElementById('modalJogadores');
  const qrData = `https://root-ligasp.vercel.app/?pid=${id}`;

  modal.innerHTML = `
    <div class="modal-box" style="max-width:340px;width:95%;">
      <div class="modal-header">
        <button onclick="_renderTelaGerenciar()" class="modal-close-btn" style="font-size:1rem;">←</button>
        <span style="font-size:0.95rem;font-weight:600;color:var(--gold);">${nome}</span>
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>

      <div class="perfil-section" style="text-align:left;">
        <div class="perfil-section-label">CÓDIGO DE JOGADOR</div>
        <p style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);margin:0 0 10px;line-height:1.4;">
          Mostre ou compartilhe para ser adicionado a uma partida.
        </p>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div class="perfil-qr-frame">
            <div id="qrCodeBox"></div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
            <div style="font-family:sans-serif;font-size:0.7rem;color:var(--text3);">ID</div>
            <div style="font-family:monospace;font-size:0.65rem;color:var(--text2);word-break:break-all;background:var(--surface);padding:6px 8px;border-radius:6px;border:1px solid var(--border);">${id}</div>
            <button class="btn-sortear" style="font-size:0.78rem;padding:0.4rem;" onclick="navigator.clipboard.writeText('${id}').then(()=>{this.textContent='✓ Copiado!';setTimeout(()=>this.textContent='📋 Copiar ID',1500)})">📋 Copiar ID</button>
          </div>
        </div>
      </div>
    </div>`;

  await _gerarQRCode('qrCodeBox', qrData, 118);
}

async function _gerarQRCode(containerId, data, size = 160) {
  if (!window.QRCode) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  // Preto sobre branco — requisito para QR scanners funcionarem
  new window.QRCode(el, {
    text: data, width: size, height: size,
    colorDark: '#000000', colorLight: '#ffffff',
  });
}

// ── Form novo/editar jogador ──────────────────────────────────────────────────

function _abrirFormNovoJogador(slotIdxParaVincular) {
  _renderFormJogador(null, '', '', null, slotIdxParaVincular);
}

function _abrirFormEditarJogador(id) {
  const j = _jogadoresCadastrados.find(x => x.id === id);
  if (!j) return;
  _renderFormJogador(j.id, j.nome, j.ludopedia_usuario || '', j.ludopedia_id || null, null);
}

function _renderFormJogador(id, nome, ludoUsuario, ludoId, slotIdxParaVincular) {
  const modal = document.getElementById('modalJogadores');
  modal.style.display = 'flex';
  const titulo = id ? 'Editar jogador' : 'Novo jogador';

  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px;width:95%;">
      <div class="modal-header">
        <button onclick="${id ? '_renderTelaGerenciar' : '_renderTelaGerenciar'}()" class="modal-close-btn" style="font-size:1rem;">←</button>
        <span style="font-size:0.95rem;font-weight:600;color:var(--gold);">${titulo}</span>
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>

      <div style="margin-bottom:0.75rem;">
        <label style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);display:block;margin-bottom:4px;">NOME *</label>
        <input id="fjNome" type="text" placeholder="Nome do jogador" value="${nome}" style="width:100%;">
      </div>

      <div style="border-top:1px solid var(--border);padding-top:0.75rem;margin-bottom:0.5rem;">
        <label style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);display:block;margin-bottom:4px;">VINCULAR CONTA DO APP (opcional)</label>
        <p style="font-family:sans-serif;font-size:0.73rem;color:var(--text3);margin-bottom:6px;line-height:1.4;">
          Se esse jogador tem conta no app e já conectou o Ludopedia, busque pelo email dele para puxar os dados automaticamente.
        </p>
        <div style="display:flex;gap:6px;">
          <input id="fjEmail" type="email" placeholder="Email da conta do app" style="flex:1;font-size:0.82rem;">
          <button class="btn-sortear" style="padding:0.4rem 0.6rem;font-size:0.75rem;white-space:nowrap;" onclick="_buscarUserPorEmail()">Buscar</button>
        </div>
        <div id="fjEmailStatus" style="font-size:0.73rem;min-height:16px;margin-top:4px;font-family:sans-serif;"></div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:0.75rem;margin-bottom:0.75rem;">
        <label style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);display:block;margin-bottom:4px;">OU: USERNAME LUDOPEDIA (opcional)</label>
        <div style="display:flex;gap:6px;">
          <input id="fjLudoNick" type="text" placeholder="Username na Ludopedia" value="${ludoUsuario}" style="flex:1;font-size:0.82rem;">
          <button class="btn-sortear" style="padding:0.4rem 0.6rem;font-size:0.75rem;white-space:nowrap;" onclick="_buscarLudoParaForm()">Buscar</button>
        </div>
        <div id="fjLudoStatus" style="font-size:0.73rem;min-height:16px;margin-top:4px;font-family:sans-serif;"></div>
      </div>

      <input type="hidden" id="fjLudoId"   value="${ludoId  || ''}">
      <input type="hidden" id="fjId"        value="${id      || ''}">
      <input type="hidden" id="fjSlotIdx"   value="${slotIdxParaVincular ?? ''}">

      <div style="display:flex;gap:8px;">
        ${id ? `<button class="ludo-btn-sm" style="color:#f09080;border-color:rgba(240,144,128,0.3);" onclick="_confirmarRemoverJogador('${id}','${nome.replace(/'/g, "\\'")}')">Remover</button>` : ''}
        <button class="btn-liga" style="flex:1;" onclick="_confirmarSalvarJogador()">
          ${id ? 'Salvar' : '+ Cadastrar'}
        </button>
      </div>
    </div>`;

  document.getElementById('fjNome')?.focus();
}

async function _buscarUserPorEmail() {
  const email = document.getElementById('fjEmail')?.value?.trim();
  const el    = document.getElementById('fjEmailStatus');
  if (!email || !el) return;
  el.style.color = 'var(--text3)'; el.textContent = '⏳ Buscando...';
  try {
    const res  = await fetch('/api/lookup-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (!res.ok || !data.found) { el.style.color = '#f09080'; el.textContent = 'Usuário não encontrado no app.'; return; }
    if (!document.getElementById('fjNome').value.trim()) document.getElementById('fjNome').value = data.nome || '';
    if (data.ludopedia_id) {
      document.getElementById('fjLudoId').value   = data.ludopedia_id;
      document.getElementById('fjLudoNick').value = data.ludopedia_usuario || '';
      el.style.color = '#80d060';
      el.textContent = `✓ ${data.nome} — 🎲 ${data.ludopedia_usuario || 'Ludopedia vinculada'}`;
    } else {
      el.style.color = '#e8c060';
      el.textContent = `✓ ${data.nome} (sem Ludopedia conectada ainda)`;
    }
  } catch { el.style.color = '#f09080'; el.textContent = 'Erro ao buscar.'; }
}

async function _buscarLudoParaForm() {
  const nick = document.getElementById('fjLudoNick')?.value?.trim();
  const el   = document.getElementById('fjLudoStatus');
  if (!nick || !el) return;
  el.style.color = 'var(--text3)'; el.textContent = '⏳ Buscando na Ludopedia...';
  try {
    const u = await buscarUsuarioLudo(nick); // retorna { id_usuario, usuario } ou null
    if (u?.usuario) {
      document.getElementById('fjLudoId').value   = u.id_usuario || '';
      document.getElementById('fjLudoNick').value = u.usuario;
      if (!document.getElementById('fjNome').value.trim()) document.getElementById('fjNome').value = u.usuario;
      el.style.color = '#80d060';
      el.textContent = `✓ ${u.usuario}${u.id_usuario ? ' (ID: ' + u.id_usuario + ')' : ''}`;
    } else {
      el.style.color = '#f09080';
      el.textContent = 'Usuário não encontrado na Ludopedia.';
    }
  } catch (e) {
    el.style.color = '#f09080';
    el.textContent = 'Erro: ' + e.message;
  }
}

async function _confirmarSalvarJogador() {
  const nome     = document.getElementById('fjNome')?.value?.trim();
  const ludoNick = document.getElementById('fjLudoNick')?.value?.trim() || null;
  const ludoId   = parseInt(document.getElementById('fjLudoId')?.value)  || null;
  const id       = document.getElementById('fjId')?.value || null;
  const slotIdx  = document.getElementById('fjSlotIdx')?.value;
  const statusEl = document.getElementById('fjLudoStatus');

  if (!nome) { if (statusEl) { statusEl.style.color = '#f09080'; statusEl.textContent = 'Nome obrigatório.'; } return; }

  try {
    await _salvarJogadorNoBanco({ id: id || null, nome, ludopedia_usuario: ludoNick, ludopedia_id: ludoId });
    // Se foi aberto a partir de um slot, vincula automaticamente
    if (slotIdx !== '') {
      const novoJogador = _jogadoresCadastrados.find(j => j.nome === nome);
      if (novoJogador) _setSlotJogador(parseInt(slotIdx), novoJogador);
    }
    fecharGerenciarJogadores();
  } catch (e) {
    if (statusEl) { statusEl.style.color = '#f09080'; statusEl.textContent = 'Erro: ' + e.message; }
  }
}

async function _confirmarRemoverJogador(id, nome) {
  if (!confirm(`Remover "${nome}" do cadastro?`)) return;
  await _removerJogadorDoBanco(id);
  _renderTelaGerenciar();
}
