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

  const nmLudo     = (ludoUser?.usuario || ludoUser?.nm_usuario || '').toLowerCase();
  const nmSupabase = (typeof currentUser !== 'undefined' ? (currentUser?.user_metadata?.full_name || '') : '').toLowerCase();
  const idLogado   = ludoUser?.id_usuario || null;
  const jogadores  = resultado.jogadores || [];

  // Tenta identificar qual jogador é o usuário logado
  // Aceita: username Ludopedia OU nome do Google/Supabase (case-insensitive)
  const isMe = j => {
    const n = (j.nome || '').toLowerCase();
    return (nmLudo && n === nmLudo) || (nmSupabase && n === nmSupabase);
  };

  const temMatch = jogadores.some(isMe);
  if (!temMatch) {
    const nomes = [nmLudo, nmSupabase].filter(Boolean).map(n => `"${n}"`).join(' ou ');
    throw new Error(`Seu usuário (${nomes}) não está na lista de jogadores desta partida. Cadastre-se com esse nome no app para registrar automaticamente.`);
  }

  // Monta array de jogadores no formato da API Ludopedia
  // Usa id_usuario do cadastro de jogadores (se disponível) ou do usuário logado
  const jogadoresLudo = jogadores.map(j => ({
    id_partida_jogador: 0,
    nome:       j.nome,
    id_usuario: j.ludopedia_id || (isMe(j) ? idLogado : null),
    fl_vencedor: j.vencedor ? 1 : 0,
    vl_pontos:   j.pontuacao !== null && j.pontuacao !== undefined ? j.pontuacao : null,
    observacao:  j.faccao || null,
  }));

  const payload = {
    id_partida:  0,
    qt_partidas: 1,
    fl_digital:  0,
    duracao:     resultado.duracao_minutos || null,
    dt_partida:  resultado.data || new Date().toISOString().split('T')[0],
    descricao:   resultado.local ? `Local: ${resultado.local}` : null,
    jogo:        { id_jogo: idJogo },
    expansoes:   [],
    jogadores:   jogadoresLudo,
  };

  return ludoFetch('partidas', { method: 'POST', body: payload });
}

async function buscarPartidasLudo() {
  if (!ludoToken || !ludoUser?.id_usuario) return [];
  const idJogo = await _getRootId();
  if (!idJogo) return [];
  const data = await ludoFetch(`partidas?id_jogo=${idJogo}&id_usuario_jogador=${ludoUser.id_usuario}&rows=50`);
  return data?.partidas || [];
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

  const logado = typeof currentUser !== 'undefined' && currentUser;

  if (logado) {
    // Quando logado, o status Ludopedia fica dentro do modal de perfil
    // Apenas atualiza o badge no avatar do header
    el.innerHTML = '';
    if (typeof renderAuthUI === 'function') renderAuthUI();
    return;
  }

  // Não logado: mostra botão de conexão Ludopedia no header
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

async function autoRegistrarLudo(resultado, containerId) {
  _ultimoResultadoLudo = resultado;
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!ludoToken) { el.innerHTML = ''; return; }

  el.innerHTML = `<div class="ludo-auto-status">⏳ Registrando na Ludopedia...</div>`;

  try {
    const resp = await registrarPartidaLudo(resultado);
    el.innerHTML = `<div class="ludo-auto-status success">🎲 Registrado na Ludopedia!</div>`;

    // Grava o id_partida da Ludopedia de volta no registro do Supabase
    const ludoId = resp?.id_partida;
    const sbId   = resultado._supabaseId;
    if (ludoId && sbId && typeof currentUser !== 'undefined' && currentUser) {
      try {
        const sb = await initSupabase();
        const { data: row } = await sb.from('historico').select('dados').eq('id', sbId).single();
        if (row) {
          await sb.from('historico').update({ dados: { ...row.dados, ludopedia_id: ludoId } }).eq('id', sbId);
        }
      } catch (e) { console.warn('Erro ao gravar ludopedia_id no Supabase:', e); }
    }
  } catch (e) {
    el.innerHTML = `
      <div class="ludo-auto-status error">
        ⚠ Ludopedia: ${e.message}
        <button class="ludo-btn-sm" style="margin-left:8px;" onclick="tentarRegistroLudoNovamente('${containerId}')">Tentar novamente</button>
      </div>`;
  }
}

async function tentarRegistroLudoNovamente(containerId) {
  if (_ultimoResultadoLudo) await autoRegistrarLudo(_ultimoResultadoLudo, containerId);
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
