// ===================== INTEGRAÇÃO LUDOPEDIA =====================

const LUDO_CLIENT_ID = '32dac072e99d0e99';
const LUDO_REDIRECT  = 'https://root-ligasp.vercel.app/';

let ludoToken = null;
let ludoUser  = null;
let _ludoRootId = null;
let _ultimoResultadoLudo = null;

// Detecta callback OAuth logo ao carregar, antes do Supabase processar o ?code=
let _pendingLudoCode = null;
(function () {
  const p = new URLSearchParams(window.location.search);
  if (p.has('code') && localStorage.getItem('ludo_connecting')) {
    _pendingLudoCode = p.get('code');
    // Limpa a URL imediatamente para o Supabase não tentar usar este code
    history.replaceState(null, '', window.location.pathname + window.location.hash);
  }
})();

// ── OAuth ─────────────────────────────────────────────────────────────────────

function conectarLudopedia() {
  localStorage.setItem('ludo_connecting', '1');
  const params = new URLSearchParams({
    app_id: LUDO_CLIENT_ID,
    redirect_uri: LUDO_REDIRECT,
  });
  window.location.href = `https://ludopedia.com.br/oauth?${params}`;
}

async function desconectarLudopedia() {
  ludoToken = null;
  ludoUser  = null;
  localStorage.removeItem('ludo_token');
  if (typeof currentUser !== 'undefined' && currentUser) {
    try {
      const sb = await initSupabase();
      await sb.from('ludopedia_tokens').delete().eq('user_id', currentUser.id);
    } catch (e) { console.warn('Erro ao remover token Ludopedia:', e); }
  }
  renderLudopediaStatus();
}

// ── Chamadas à API via proxy ──────────────────────────────────────────────────

async function ludoFetch(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (ludoToken) headers['Authorization'] = `Bearer ${ludoToken}`;

  const res = await fetch(`/api/ludopedia?endpoint=${encodeURIComponent(endpoint)}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Erro ${res.status}`);
  return data;
}

// ── Perfil e coleção ──────────────────────────────────────────────────────────

async function carregarPerfilLudo() {
  const data = await ludoFetch('me');
  // API retorna: { id_usuario, usuario, thumb }
  ludoUser = { ...data, nm_usuario: data.usuario };
  return ludoUser;
}

async function buscarUsuarioLudo(nmUsuario) {
  return ludoFetch(`usuarios/${encodeURIComponent(nmUsuario)}`);
}

async function _getRootId() {
  if (_ludoRootId) return _ludoRootId;
  const cached = localStorage.getItem('ludo_root_id');
  if (cached) { _ludoRootId = parseInt(cached); return _ludoRootId; }
  try {
    // search = busca por nome, tp_jogo=b = apenas jogos base (não expansões)
    const data = await ludoFetch('jogos?search=Root&tp_jogo=b&rows=20');
    const lista = data?.jogos || [];
    const jogo = lista.find(j => j.nm_jogo?.toLowerCase() === 'root')
      || lista.find(j => j.nm_jogo?.toLowerCase().startsWith('root:'))
      || lista.find(j => j.nm_jogo?.toLowerCase().includes('root'));
    if (jogo?.id_jogo) {
      _ludoRootId = jogo.id_jogo;
      localStorage.setItem('ludo_root_id', String(_ludoRootId));
    }
  } catch (e) { console.warn('Root não encontrado na Ludopedia:', e); }
  return _ludoRootId;
}

async function buscarColecaoRoot(idUsuario) {
  const id = await _getRootId();
  if (!id || !idUsuario) return null;
  return ludoFetch(`colecao?id_usuario=${idUsuario}&id_jogo=${id}`);
}

// ── Registrar partida ─────────────────────────────────────────────────────────

async function registrarPartidaLudo(resultado) {
  if (!ludoToken) throw new Error('Conta Ludopedia não conectada');

  const idJogo = await _getRootId();
  if (!idJogo) throw new Error('Root não encontrado na Ludopedia. Tente novamente mais tarde.');

  // Identifica o jogador logado pelo nm_usuario da Ludopedia
  const nmLogado = ludoUser?.usuario || ludoUser?.nm_usuario;
  const jogadores = resultado.jogadores || [];
  const jogadorLogado = jogadores.find(j => j.ludopedia_nick === nmLogado) || jogadores[0];
  const ganhou = jogadorLogado?.vencedor ? 'S' : 'N';
  const pontos = jogadorLogado?.pontuacao ?? 0;

  const payload = {
    id_jogo: idJogo,
    dt_partida: resultado.data || new Date().toISOString().split('T')[0],
    fl_ganhou: ganhou,
    qt_jogadores: jogadores.length,
  };
  if (pontos) payload.vl_pontos = pontos;
  if (resultado.local) payload.ds_local = resultado.local;

  return ludoFetch('partidas', { method: 'POST', body: payload });
}

// ── Supabase — salvar/carregar token ─────────────────────────────────────────

async function salvarTokenLudo(token) {
  if (!(typeof currentUser !== 'undefined' && currentUser)) return;
  try {
    const sb = await initSupabase();
    await sb.from('ludopedia_tokens').upsert({
      user_id:       currentUser.id,
      access_token:  token,
      nm_usuario:    ludoUser?.usuario || ludoUser?.nm_usuario || null,
      atualizado_em: new Date().toISOString(),
    });
  } catch (e) { console.warn('Erro ao salvar token Ludopedia:', e); }
}

async function carregarTokenLudo() {
  if (!(typeof currentUser !== 'undefined' && currentUser)) return;
  try {
    const sb = await initSupabase();
    const { data } = await sb
      .from('ludopedia_tokens')
      .select('*')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (data?.access_token) {
      ludoToken = data.access_token;
      ludoUser  = { nm_usuario: data.nm_usuario };
      localStorage.setItem('ludo_token', ludoToken);
    }
  } catch (e) { /* nenhum token salvo */ }
}

// ── UI — status da conexão ────────────────────────────────────────────────────

function renderLudopediaStatus() {
  const el = document.getElementById('ludopediaStatus');
  if (!el) return;

  if (ludoToken) {
    const nome = ludoUser?.usuario || ludoUser?.nm_usuario || '—';
    el.innerHTML = `
      <div class="ludo-status connected" title="Ludopedia conectada">
        <span class="ludo-icon">🎲</span>
        <div class="ludo-info">
          <div class="ludo-label">Ludopedia</div>
          <div class="ludo-nome">${nome}</div>
        </div>
        <button class="ludo-btn-sm" onclick="desconectarLudopedia()">Desconectar</button>
      </div>`;
  } else {
    el.innerHTML = `
      <button class="ludo-btn-connect" onclick="conectarLudopedia()" title="Conectar conta Ludopedia">
        🎲 Ludopedia
      </button>`;
  }
}

// ── UI — botão registrar partida ──────────────────────────────────────────────

function mostrarBotaoLudo(resultado, containerId) {
  _ultimoResultadoLudo = resultado;
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!ludoToken) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button class="ludo-btn-registrar" onclick="executarRegistroLudo(this)">
      🎲 Registrar partida na Ludopedia
    </button>`;
}

async function executarRegistroLudo(btn) {
  if (!_ultimoResultadoLudo) return;
  btn.disabled = true;
  btn.textContent = '⏳ Registrando...';
  try {
    await registrarPartidaLudo(_ultimoResultadoLudo);
    btn.textContent = '✓ Registrado na Ludopedia!';
    btn.className = 'ludo-btn-registrar success';
  } catch (e) {
    btn.textContent = '⚠ ' + e.message;
    btn.className = 'ludo-btn-registrar error';
    btn.disabled = false;
  }
}

// ── UI — buscar usuário (para campos de jogador) ──────────────────────────────

async function pesquisarJogadorLudo(inputId, resultId, i) {
  const nick = document.getElementById(inputId)?.value?.trim();
  const el   = document.getElementById(resultId);
  if (!el || !nick) return;
  el.innerHTML = '<span style="font-size:0.75rem;color:var(--text3);font-family:sans-serif;">Buscando...</span>';
  try {
    const data = await buscarUsuarioLudo(nick);
    const u = data?.usuario || data;
    if (u?.nm_usuario) {
      el.innerHTML = `
        <div class="ludo-user-found">
          <span>✓ ${u.nm_usuario}</span>
          <button onclick="confirmarNickLudo(${i},'${u.nm_usuario}','${resultId}')" class="ludo-btn-sm">Vincular</button>
        </div>`;
    } else {
      el.innerHTML = '<span style="font-size:0.75rem;color:#f09080;font-family:sans-serif;">Usuário não encontrado</span>';
    }
  } catch {
    el.innerHTML = '<span style="font-size:0.75rem;color:#f09080;font-family:sans-serif;">Usuário não encontrado</span>';
  }
}

function confirmarNickLudo(i, nick, resultId) {
  // Salva o nick no formulário de resultado
  const input = document.getElementById(`pLudoNick_${i}`);
  if (input) input.value = nick;
  const el = document.getElementById(resultId);
  if (el) el.innerHTML = `<span style="font-size:0.75rem;color:#80d060;font-family:sans-serif;">✓ Vinculado: ${nick}</span>`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initLudopedia() {
  // Processar callback OAuth pendente
  if (_pendingLudoCode) {
    const code = _pendingLudoCode;
    _pendingLudoCode = null;
    localStorage.removeItem('ludo_connecting');
    renderLudopediaConnecting();

    const jaLogado = typeof currentUser !== 'undefined' && currentUser;

    if (jaLogado) {
      // Já tem sessão Google → só adiciona o token Ludopedia à conta existente
      try {
        const res = await fetch('/api/ludopedia-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Falha');
        ludoToken = d.access_token || d.token;
        if (!ludoToken) throw new Error('Token não recebido');
        localStorage.setItem('ludo_token', ludoToken);
        try { await carregarPerfilLudo(); } catch (e) { console.warn('Perfil:', e.message); }
        await salvarTokenLudo(ludoToken);
      } catch (e) { console.error('Erro Ludopedia (já logado):', e); }
      renderLudopediaStatus();
    } else {
      // Sem sessão → cria sessão Supabase via Ludopedia
      try {
        const res = await fetch('/api/ludopedia-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Falha na autenticação');

        // Salva token e perfil no localStorage antes de redirecionar
        localStorage.setItem('ludo_token', d.ludo_token);
        localStorage.setItem('ludo_nm_usuario', d.usuario || '');

        // Redireciona para o magic link do Supabase — ele processa e volta pro app já logado
        // (evita problemas de PKCE ao chamar verifyOtp manualmente)
        window.location.href = d.action_link;
      } catch (e) {
        console.error('Erro Ludopedia auth:', e);
        renderLudopediaStatus();
      }
    }
    return;
  }

  // Tentar token do localStorage
  const local = localStorage.getItem('ludo_token');
  if (local) {
    ludoToken = local;
    const savedNome = localStorage.getItem('ludo_nm_usuario');
    if (savedNome) ludoUser = { usuario: savedNome, nm_usuario: savedNome };
    try { await carregarPerfilLudo(); } catch (e) { console.warn('Perfil Ludopedia indisponível:', e.message); }
    await salvarTokenLudo(ludoToken); // Persiste no Supabase se estiver logado
    renderLudopediaStatus();
    return;
  }

  // Tentar token do Supabase
  await carregarTokenLudo();
  if (ludoToken) {
    try { await carregarPerfilLudo(); } catch (e) { console.warn('Perfil Ludopedia indisponível:', e.message); }
  }
  renderLudopediaStatus();
}

function renderLudopediaConnecting() {
  const el = document.getElementById('ludopediaStatus');
  if (el) el.innerHTML = `<div class="ludo-status" style="opacity:.65;font-family:sans-serif;font-size:0.8rem;color:var(--text3);">⏳ Conectando Ludopedia...</div>`;
}
