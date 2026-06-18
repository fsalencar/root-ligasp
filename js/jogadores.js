// ===================== CADASTRO E SELEÇÃO DE JOGADORES =====================

// Jogadores da partida atual
let _playersForMatch = [];
// Cache do banco
let _jogadoresCadastrados = [];

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

// ── Partida atual ─────────────────────────────────────────────────────────────

function adicionarJogadorAMatch(jogador) {
  // Evita duplicado pelo nome
  if (_playersForMatch.some(p => p.nome.toLowerCase() === jogador.nome.toLowerCase())) return;
  _playersForMatch.push({ ...jogador });
  if (typeof renderPlayersGrid === 'function') { numPlayers = _playersForMatch.length; renderPlayersGrid(); updateInsurgentToggle(); updateReachInfo(); }
}

function removerPlayerMatch(i) {
  _playersForMatch.splice(i, 1);
  if (typeof renderPlayersGrid === 'function') { numPlayers = _playersForMatch.length; renderPlayersGrid(); updateInsurgentToggle(); updateReachInfo(); }
}

function getLudoDataParaSlot(i) {
  const p = _playersForMatch[i];
  if (!p || !p.ludopedia_id) return null;
  return { ludopedia_id: p.ludopedia_id, ludopedia_usuario: p.ludopedia_usuario };
}

// ── Modal principal de seleção ────────────────────────────────────────────────

function abrirSelecionarJogadoresModal() {
  const modal = document.getElementById('modalJogadores');
  if (!modal) return;
  modal.style.display = 'flex';
  _renderTelaSelecao();
}

function fecharGerenciarJogadores() {
  const modal = document.getElementById('modalJogadores');
  if (modal) modal.style.display = 'none';
}

function _renderTelaSelecao() {
  const modal = document.getElementById('modalJogadores');
  const selecionados = new Set(_playersForMatch.map(p => p.nome.toLowerCase()));

  modal.innerHTML = `
    <div class="modal-box" style="max-width:440px;width:95%;max-height:90vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <span style="font-size:1rem;font-weight:600;color:var(--gold);">👥 Jogadores</span>
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:0.75rem;">
        <button class="btn-sortear" style="flex:1;padding:0.5rem;font-size:0.82rem;" onclick="_renderTelaNovoJogador()">
          🧑 Novo jogador
        </button>
        <button class="ludo-btn-sm" style="flex:1;padding:0.5rem;font-size:0.82rem;" onclick="_adicionarConvidadoModal()">
          + Convidado
        </button>
      </div>

      <input type="text" placeholder="🔍 Pesquisar jogador..." id="buscaJogadorModal"
        oninput="_filtrarListaModal()"
        style="margin-bottom:0.75rem;width:100%;padding:0.5rem 0.75rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface2);color:var(--text1);font-size:0.85rem;">

      <div id="listaJogadoresModal" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;min-height:80px;">
        ${_renderItensSelecao(_jogadoresCadastrados, selecionados)}
      </div>

      <div style="margin-top:0.75rem;border-top:1px solid var(--border);padding-top:0.75rem;">
        <button class="btn-liga" style="width:100%;" onclick="fecharGerenciarJogadores()">Confirmar seleção</button>
      </div>
    </div>`;
}

function _renderItensSelecao(lista, selecionados) {
  if (!lista.length) {
    return `<div style="text-align:center;padding:1.5rem;font-family:sans-serif;color:var(--text3);font-size:0.82rem;">
      Nenhum jogador cadastrado.<br>Clique em "Novo jogador" para adicionar.
    </div>`;
  }
  return lista.map(j => {
    const sel = selecionados.has(j.nome.toLowerCase());
    return `
      <div class="jogador-sel-item ${sel ? 'selecionado' : ''}" onclick="_toggleJogadorSelecao('${j.id}','${j.nome.replace(/'/g, "\\'")}',${j.ludopedia_id||'null'},'${j.ludopedia_usuario||''}')">
        <div style="flex:1;min-width:0;">
          <div class="jsel-nome">${j.nome}</div>
          ${j.ludopedia_usuario ? `<div class="jsel-sub">🎲 ${j.ludopedia_usuario}</div>` : '<div class="jsel-sub" style="opacity:.35;">sem Ludopedia</div>'}
        </div>
        <div class="jsel-check">${sel ? '✓' : ''}</div>
        <button class="jsel-edit-btn" onclick="event.stopPropagation();_renderTelaEditarJogador('${j.id}','${j.nome.replace(/'/g, "\\'")}','${j.ludopedia_usuario||''}',${j.ludopedia_id||'null'})" title="Editar">✏️</button>
      </div>`;
  }).join('');
}

function _filtrarListaModal() {
  const q = document.getElementById('buscaJogadorModal')?.value?.toLowerCase() || '';
  const lista = q ? _jogadoresCadastrados.filter(j => j.nome.toLowerCase().includes(q)) : _jogadoresCadastrados;
  const selecionados = new Set(_playersForMatch.map(p => p.nome.toLowerCase()));
  const el = document.getElementById('listaJogadoresModal');
  if (el) el.innerHTML = _renderItensSelecao(lista, selecionados);
}

function _toggleJogadorSelecao(id, nome, ludopediaId, ludopediaUsuario) {
  const idx = _playersForMatch.findIndex(p => p.nome.toLowerCase() === nome.toLowerCase());
  if (idx >= 0) {
    _playersForMatch.splice(idx, 1);
  } else {
    _playersForMatch.push({ id, nome, ludopedia_id: ludopediaId || null, ludopedia_usuario: ludopediaUsuario || null, isGuest: false });
  }
  numPlayers = _playersForMatch.length;
  if (typeof renderPlayersGrid === 'function') { renderPlayersGrid(); updateInsurgentToggle(); updateReachInfo(); }
  _filtrarListaModal();
}

// ── Convidado ─────────────────────────────────────────────────────────────────

function adicionarConvidadoSorteio() {
  fecharGerenciarJogadores();
  _adicionarConvidadoPrompt();
}

function _adicionarConvidadoModal() {
  const modal = document.getElementById('modalJogadores');
  modal.innerHTML = `
    <div class="modal-box" style="max-width:380px;width:95%;">
      <div class="modal-header">
        <button onclick="_renderTelaSelecao()" class="modal-close-btn" style="font-size:1rem;">← Voltar</button>
        <span style="font-size:0.95rem;font-weight:600;color:var(--gold);">Adicionar convidado</span>
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>
      <p style="font-family:sans-serif;font-size:0.82rem;color:var(--text3);margin-bottom:0.75rem;">
        Convidado não fica salvo na lista. Para registrar permanentemente use "Novo jogador".
      </p>
      <input id="nomeConvidadoModal" type="text" placeholder="Nome do convidado"
        style="width:100%;margin-bottom:0.75rem;"
        onkeydown="if(event.key==='Enter')_confirmarConvidadoModal()">
      <button class="btn-liga" style="width:100%;" onclick="_confirmarConvidadoModal()">+ Adicionar convidado</button>
    </div>`;
  document.getElementById('nomeConvidadoModal')?.focus();
}

function _confirmarConvidadoModal() {
  const nome = document.getElementById('nomeConvidadoModal')?.value?.trim();
  if (!nome) return;
  adicionarJogadorAMatch({ nome, ludopedia_id: null, ludopedia_usuario: null, isGuest: true });
  _renderTelaSelecao();
}

function _adicionarConvidadoPrompt() {
  const nome = prompt('Nome do convidado:');
  if (nome?.trim()) adicionarJogadorAMatch({ nome: nome.trim(), isGuest: true });
}

// ── Novo jogador / Editar ─────────────────────────────────────────────────────

function _renderTelaNovoJogador() {
  if (typeof currentUser === 'undefined' || !currentUser) {
    alert('Faça login para cadastrar jogadores.');
    return;
  }
  _renderFormJogador(null, '', '', null);
}

function _renderTelaEditarJogador(id, nome, ludoUsuario, ludoId) {
  _renderFormJogador(id, nome, ludoUsuario, ludoId);
}

function _renderFormJogador(id, nome, ludoUsuario, ludoId) {
  const modal = document.getElementById('modalJogadores');
  const titulo = id ? 'Editar jogador' : 'Novo jogador';

  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px;width:95%;">
      <div class="modal-header">
        <button onclick="_renderTelaSelecao()" class="modal-close-btn" style="font-size:1rem;">← Voltar</button>
        <span style="font-size:0.95rem;font-weight:600;color:var(--gold);">${titulo}</span>
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>

      <div style="margin-bottom:0.75rem;">
        <label style="font-family:sans-serif;font-size:0.78rem;color:var(--text3);display:block;margin-bottom:4px;">NOME DO JOGADOR *</label>
        <input id="fjNome" type="text" placeholder="Nome do jogador" value="${nome}"
          style="width:100%;">
      </div>

      <div style="border-top:1px solid var(--border);padding-top:0.75rem;margin-bottom:0.5rem;">
        <label style="font-family:sans-serif;font-size:0.78rem;color:var(--text3);display:block;margin-bottom:4px;">VINCULAR AO APP (opcional)</label>
        <p style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);margin-bottom:0.5rem;line-height:1.4;">
          Se este jogador tem conta no app e já conectou o Ludopedia, busque pelo email dele para puxar os dados automaticamente.
        </p>
        <div style="display:flex;gap:6px;">
          <input id="fjEmail" type="email" placeholder="Email da conta do app" style="flex:1;font-size:0.82rem;">
          <button class="btn-sortear" style="padding:0.4rem 0.6rem;font-size:0.75rem;white-space:nowrap;" onclick="_buscarUserPorEmail()">Buscar</button>
        </div>
        <div id="fjEmailStatus" style="font-size:0.75rem;min-height:16px;margin-top:4px;font-family:sans-serif;"></div>
      </div>

      <div style="border-top:1px solid var(--border);padding-top:0.75rem;margin-bottom:0.75rem;">
        <label style="font-family:sans-serif;font-size:0.78rem;color:var(--text3);display:block;margin-bottom:4px;">OU: USERNAME LUDOPEDIA (opcional)</label>
        <div style="display:flex;gap:6px;">
          <input id="fjLudoNick" type="text" placeholder="Username na Ludopedia" value="${ludoUsuario}" style="flex:1;font-size:0.82rem;">
          <button class="btn-sortear" style="padding:0.4rem 0.6rem;font-size:0.75rem;white-space:nowrap;" onclick="_buscarLudoParaForm()">Buscar</button>
        </div>
        <div id="fjLudoStatus" style="font-size:0.75rem;min-height:16px;margin-top:4px;font-family:sans-serif;"></div>
      </div>

      <input type="hidden" id="fjLudoId" value="${ludoId || ''}">
      <input type="hidden" id="fjId" value="${id || ''}">

      <div style="display:flex;gap:8px;">
        ${id ? `<button class="ludo-btn-sm" style="color:#f09080;border-color:rgba(240,144,128,0.3);" onclick="_confirmarRemoverJogador('${id}','${nome.replace(/'/g, "\\'")}')">Remover</button>` : ''}
        <button class="btn-liga" style="flex:1;" onclick="_confirmarSalvarJogador()">
          ${id ? 'Salvar alterações' : '+ Cadastrar jogador'}
        </button>
      </div>
    </div>`;

  document.getElementById('fjNome')?.focus();
}

async function _buscarUserPorEmail() {
  const email = document.getElementById('fjEmail')?.value?.trim();
  const el    = document.getElementById('fjEmailStatus');
  if (!email || !el) return;
  el.style.color = 'var(--text3)';
  el.textContent = '⏳ Buscando...';
  try {
    const res  = await fetch('/api/lookup-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (!res.ok || !data.found) { el.style.color = '#f09080'; el.textContent = 'Usuário não encontrado no app.'; return; }

    // Preenche nome se estiver vazio
    if (!document.getElementById('fjNome').value.trim()) document.getElementById('fjNome').value = data.nome || '';

    if (data.ludopedia_id) {
      document.getElementById('fjLudoId').value   = data.ludopedia_id;
      document.getElementById('fjLudoNick').value = data.ludopedia_usuario || '';
      el.style.color = '#80d060';
      el.textContent = `✓ ${data.nome} — 🎲 ${data.ludopedia_usuario || 'Ludopedia vinculada'}`;
    } else {
      el.style.color = '#e8c060';
      el.textContent = `✓ ${data.nome} encontrado (sem Ludopedia conectada)`;
    }
  } catch {
    el.style.color = '#f09080'; el.textContent = 'Erro ao buscar.';
  }
}

async function _buscarLudoParaForm() {
  const nick = document.getElementById('fjLudoNick')?.value?.trim();
  const el   = document.getElementById('fjLudoStatus');
  if (!nick || !el) return;
  el.style.color = 'var(--text3)'; el.textContent = '⏳ Buscando na Ludopedia...';
  try {
    const data = await buscarUsuarioLudo(nick);
    const u = data?.usuario || data;
    if (u?.id_usuario) {
      document.getElementById('fjLudoId').value   = u.id_usuario;
      document.getElementById('fjLudoNick').value = u.nm_usuario || nick;
      if (!document.getElementById('fjNome').value.trim()) document.getElementById('fjNome').value = u.nm_usuario || nick;
      el.style.color = '#80d060';
      el.textContent = `✓ Encontrado: ${u.nm_usuario} (ID: ${u.id_usuario})`;
    } else {
      el.style.color = '#f09080'; el.textContent = 'Usuário não encontrado na Ludopedia.';
    }
  } catch {
    el.style.color = '#f09080'; el.textContent = 'Erro ao buscar na Ludopedia.';
  }
}

async function _confirmarSalvarJogador() {
  const nome      = document.getElementById('fjNome')?.value?.trim();
  const ludoNick  = document.getElementById('fjLudoNick')?.value?.trim() || null;
  const ludoId    = parseInt(document.getElementById('fjLudoId')?.value) || null;
  const id        = document.getElementById('fjId')?.value || null;
  const statusEl  = document.getElementById('fjLudoStatus');

  if (!nome) { if (statusEl) { statusEl.style.color = '#f09080'; statusEl.textContent = 'Nome obrigatório.'; } return; }

  try {
    await _salvarJogadorNoBanco({ id: id || null, nome, ludopedia_usuario: ludoNick, ludopedia_id: ludoId });
    _renderTelaSelecao();
  } catch (e) {
    if (statusEl) { statusEl.style.color = '#f09080'; statusEl.textContent = 'Erro: ' + e.message; }
  }
}

async function _confirmarRemoverJogador(id, nome) {
  if (!confirm(`Remover "${nome}" do cadastro?`)) return;
  // Remove da partida atual se estiver lá
  const idx = _playersForMatch.findIndex(p => p.nome.toLowerCase() === nome.toLowerCase());
  if (idx >= 0) _playersForMatch.splice(idx, 1);
  await _removerJogadorDoBanco(id);
  if (typeof renderPlayersGrid === 'function') renderPlayersGrid();
  _renderTelaSelecao();
}
