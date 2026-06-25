// Listagem de todas as partidas para admin/super_user/embaixador

let _partidasAdminData = [];
let _adminBuscaAtual   = '';

const _PA_STATUS_BADGE = {
  pendente_aprovacao: '<span class="liga-badge badge-pendente">⏳ Pendente</span>',
  pendente_revisao:   '<span class="liga-badge badge-revisao">✏ Revisão</span>',
  aprovada:           '<span class="liga-badge badge-aprovada">✓ Aprovada</span>',
  reprovada:          '<span class="liga-badge badge-reprovada">✗ Reprovada</span>',
};

async function carregarPartidasAdmin() {
  const section = document.getElementById('tab-partidas');
  if (!section) return;
  if (!currentUser) {
    section.innerHTML = '<div class="section" style="text-align:center;padding:2rem;"><div style="font-family:sans-serif;color:var(--text3);">Login necessário.</div></div>';
    return;
  }

  section.innerHTML = '<div class="section" style="text-align:center;padding:2rem;"><div style="font-family:sans-serif;color:var(--text3);">Carregando...</div></div>';

  try {
    const sb = await initSupabase();
    const { data, error } = await sb
      .from('partidas_liga')
      .select('*')
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    _partidasAdminData = data || [];
    _adminBuscaAtual   = '';
    _renderPartidasAdmin(section);
  } catch (e) {
    section.innerHTML = `<div class="section"><div style="text-align:center;padding:2rem;font-family:sans-serif;color:#f09080;">Erro: ${e.message}</div></div>`;
  }
}

function _renderPartidasAdmin(section) {
  const canDelete = ['admin', 'super_user'].includes(currentUserRole);
  const canTrash  = ['admin', 'super_user', 'embaixador'].includes(currentUserRole);

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Todas as Partidas (${_partidasAdminData.length})</div>
      <div style="display:flex;gap:8px;margin-bottom:1rem;flex-wrap:wrap;align-items:center;">
        <input type="text" id="adminPartidasBusca" placeholder="Buscar por #ID, jogador, mapa, local..."
          oninput="_filtrarPartidasAdmin(this.value)"
          value="${_adminBuscaAtual}"
          style="flex:1;min-width:200px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.45rem 0.75rem;color:var(--text);font-family:sans-serif;font-size:0.85rem;">
        ${canTrash ? `
          <button onclick="_abrirLixeira()"
            style="background:transparent;color:var(--text3);border:1px solid var(--border);border-radius:var(--radius);padding:0.45rem 0.85rem;font-size:0.8rem;font-family:sans-serif;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:5px;">
            🗑 Lixeira
          </button>` : ''}
      </div>
      <div style="overflow-x:auto;border-radius:var(--radius);border:1px solid var(--border);">
        <table style="width:100%;border-collapse:collapse;min-width:520px;">
          <thead>
            <tr style="border-bottom:1px solid var(--border2);">
              <th style="padding:8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Data · #ID</th>
              <th style="padding:8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Enviado por</th>
              <th style="padding:8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Jogadores</th>
              <th style="padding:8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Vencedor</th>
              <th style="padding:8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Status</th>
            </tr>
          </thead>
          <tbody id="adminPartidasListBody">
            ${_renderPartidasRows(_adminBuscaAtual
              ? _partidasAdminData.filter(_matchBusca)
              : _partidasAdminData)}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _matchBusca(p) {
  const q = _adminBuscaAtual;
  const d = p.dados || {};
  const nomes = (d.jogadores || []).map(j => j.nome).join(' ').toLowerCase();
  return (
    p.id.toLowerCase().includes(q) ||
    nomes.includes(q) ||
    (d.mapa || '').toLowerCase().includes(q) ||
    (d.local || '').toLowerCase().includes(q) ||
    (d.submitter_name || '').toLowerCase().includes(q)
  );
}

function _renderPartidasRows(lista) {
  if (!lista.length) {
    return `<tr><td colspan="5" style="text-align:center;padding:1.5rem;font-family:sans-serif;color:var(--text3);font-size:0.82rem;">Nenhuma partida encontrada.</td></tr>`;
  }
  return lista.map(p => {
    const d           = p.dados || {};
    const jogadores   = (d.jogadores || []).map(j => j.nome).join(', ') || '—';
    const vencedorObj = (d.jogadores || []).find(j => j.vencedor);
    const vencedor    = vencedorObj ? vencedorObj.nome : '—';
    const dataStr     = p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—';
    const badge       = _PA_STATUS_BADGE[p.status] || '';
    const shortId     = p.id.slice(0, 8);

    return `
      <tr onclick="_abrirDetalhePartida('${p.id}')"
          style="cursor:pointer;transition:background 0.15s;"
          onmouseover="this.style.background='var(--surface2)'"
          onmouseout="this.style.background=''">
        <td style="padding:10px 8px;">
          <div style="font-family:sans-serif;font-size:0.8rem;color:var(--text3);white-space:nowrap;">${dataStr}</div>
          <div style="font-family:monospace;font-size:0.62rem;color:var(--text3);opacity:0.5;margin-top:2px;">#${shortId}</div>
        </td>
        <td style="padding:10px 8px;font-family:sans-serif;font-size:0.8rem;color:var(--text2);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.submitter_name || '—'}</td>
        <td style="padding:10px 8px;font-family:sans-serif;font-size:0.8rem;color:var(--text1);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${jogadores}">${jogadores}</td>
        <td style="padding:10px 8px;font-family:sans-serif;font-size:0.8rem;color:var(--gold);white-space:nowrap;">🏆 ${vencedor}</td>
        <td style="padding:10px 8px;">${badge}</td>
      </tr>`;
  }).join('');
}

function _filtrarPartidasAdmin(q) {
  _adminBuscaAtual = (q || '').toLowerCase().trim();
  const tbody = document.getElementById('adminPartidasListBody');
  if (!tbody) return;
  const lista = _adminBuscaAtual ? _partidasAdminData.filter(_matchBusca) : _partidasAdminData;
  tbody.innerHTML = _renderPartidasRows(lista);
}

// ── Detalhe da partida ────────────────────────────────────────────

function _abrirDetalhePartida(id) {
  const p = _partidasAdminData.find(x => x.id === id);
  if (!p) return;
  const d         = p.dados || {};
  const jogadores = d.jogadores || [];
  const dataStr   = d.data || (p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—');
  const badge     = _PA_STATUS_BADGE[p.status] || '';
  const canDelete = ['admin', 'super_user'].includes(currentUserRole);

  const fotos = (p.foto_pontuacao_url || p.foto_jogadores_url) ? `
    <div style="display:flex;gap:8px;margin-top:12px;">
      ${p.foto_pontuacao_url ? `
        <a href="${p.foto_pontuacao_url}" target="_blank" rel="noopener" style="flex:1;display:block;border-radius:6px;overflow:hidden;border:1px solid var(--border);text-decoration:none;">
          <img src="${p.foto_pontuacao_url}" loading="lazy" style="width:100%;height:90px;object-fit:cover;display:block;">
          <div style="font-family:sans-serif;font-size:0.68rem;color:var(--text3);text-align:center;padding:3px 0;">📸 Pontuação</div>
        </a>` : ''}
      ${p.foto_jogadores_url ? `
        <a href="${p.foto_jogadores_url}" target="_blank" rel="noopener" style="flex:1;display:block;border-radius:6px;overflow:hidden;border:1px solid var(--border);text-decoration:none;">
          <img src="${p.foto_jogadores_url}" loading="lazy" style="width:100%;height:90px;object-fit:cover;display:block;">
          <div style="font-family:sans-serif;font-size:0.68rem;color:var(--text3);text-align:center;padding:3px 0;">👥 Jogadores</div>
        </a>` : ''}
    </div>` : '';

  const listaJogadores = jogadores.map(j => {
    const label = j.vencedor
      ? (j.pontuacao == null ? '🏆 Vitória por Domínio' : `🏆 ${j.pontuacao} pts`)
      : (j.pontuacao == null ? 'Derrota por Domínio' : `${j.pontuacao} pts`);
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-family:sans-serif;font-size:0.8rem;">
      <span style="color:${j.vencedor ? 'var(--gold)' : 'var(--text1)'};">${j.nome}${j.faccao ? ' · ' + j.faccao : ''}</span>
      <span style="color:${j.vencedor ? 'var(--gold)' : 'var(--text3)'};font-size:0.75rem;white-space:nowrap;margin-left:8px;">${label}</span>
    </div>`;
  }).join('');

  const box = document.getElementById('modalPartidaDetalheBox');
  box.innerHTML = `
    <button class="auth-close" onclick="_fecharDetalhePartida()">✕</button>
    <div style="font-family:sans-serif;font-size:1rem;font-weight:700;color:var(--text1);margin-bottom:4px;">Detalhes da Partida</div>
    <div style="font-family:monospace;font-size:0.68rem;color:var(--text3);opacity:0.6;margin-bottom:8px;">#${p.id}</div>
    <div style="margin-bottom:10px;">${badge}</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
      <div style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);">📅 Data<br><span style="color:var(--text1);font-size:0.85rem;">${dataStr}</span></div>
      <div style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);">📍 Local<br><span style="color:var(--text1);font-size:0.85rem;">${d.local || '—'}</span></div>
      ${d.mapa ? `<div style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);grid-column:1/-1;">🗺️ Mapa<br><span style="color:var(--text1);font-size:0.85rem;">${d.mapa}</span></div>` : ''}
      <div style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);grid-column:1/-1;">👤 Enviado por<br><span style="color:var(--text2);font-size:0.85rem;">${d.submitter_name || '—'}</span></div>
    </div>

    <div style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);margin-bottom:6px;">Jogadores</div>
    <div style="margin-bottom:12px;">${listaJogadores || '<span style="font-family:sans-serif;font-size:0.8rem;color:var(--text3);">—</span>'}</div>

    ${p.nota_embaixador ? `
      <div style="padding:8px 10px;background:var(--surface2);border-radius:8px;font-family:sans-serif;font-size:0.78rem;color:var(--text2);line-height:1.4;margin-bottom:12px;">
        <strong style="color:var(--text3);">Nota do embaixador:</strong> ${p.nota_embaixador}
      </div>` : ''}

    ${fotos}

    ${canDelete ? `
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
        <button onclick="_confirmarApagarPartida('${p.id}')"
          style="width:100%;background:rgba(200,60,40,0.15);color:#f08070;border:1px solid rgba(200,60,40,0.3);border-radius:var(--radius);padding:0.5rem 1rem;font-family:sans-serif;font-size:0.82rem;font-weight:600;cursor:pointer;">
          🗑 Mover para lixeira
        </button>
        <div id="modalPartidaMsg" style="font-family:sans-serif;font-size:0.75rem;text-align:center;margin-top:6px;"></div>
      </div>` : ''}`;

  document.getElementById('modalPartidaDetalhe').style.display = 'flex';
}

function _fecharDetalhePartida() {
  const modal = document.getElementById('modalPartidaDetalhe');
  if (modal) modal.style.display = 'none';
}

function _confirmarApagarPartida(id) {
  if (!confirm('Mover esta partida para a lixeira? Ela será apagada permanentemente após 7 dias.')) return;
  _apagarPartida(id);
}

async function _apagarPartida(id) {
  const msg = document.getElementById('modalPartidaMsg');
  if (msg) { msg.style.color = 'var(--text3)'; msg.textContent = 'Movendo para lixeira...'; }

  try {
    const sb = await initSupabase();
    const { data: { session } } = await sb.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Sessão inválida');

    const res  = await fetch('/api/apagar-partida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify({ partida_id: id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao apagar');

    _partidasAdminData = _partidasAdminData.filter(x => x.id !== id);
    _fecharDetalhePartida();
    _renderPartidasAdmin(document.getElementById('tab-partidas'));
  } catch (e) {
    if (msg) { msg.style.color = '#f09080'; msg.textContent = 'Erro: ' + e.message; }
  }
}

// ── Lixeira ───────────────────────────────────────────────────────

async function _abrirLixeira() {
  const section = document.getElementById('tab-partidas');
  section.innerHTML = '<div class="section" style="text-align:center;padding:2rem;"><div style="font-family:sans-serif;color:var(--text3);">Carregando lixeira...</div></div>';

  try {
    const sb = await initSupabase();
    const { data: { session } } = await sb.auth.getSession();

    // Dispara limpeza de itens > 7 dias em background
    if (session?.access_token) {
      fetch('/api/limpar-lixeira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      }).catch(() => {});
    }

    const { data, error } = await sb
      .from('partidas_liga')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });
    if (error) throw error;

    _renderLixeira(section, data || []);
  } catch (e) {
    section.innerHTML = `<div class="section"><div style="text-align:center;padding:2rem;font-family:sans-serif;color:#f09080;">Erro: ${e.message}</div></div>`;
  }
}

function _renderLixeira(section, lista) {
  const now       = Date.now();
  const canRestore = ['admin', 'super_user', 'embaixador'].includes(currentUserRole);

  const cards = lista.map(p => {
    const d           = p.dados || {};
    const jogadores   = (d.jogadores || []).map(j => j.nome).join(', ') || '—';
    const vencedorObj = (d.jogadores || []).find(j => j.vencedor);
    const vencedor    = vencedorObj ? vencedorObj.nome : '—';
    const dataPartida = p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—';
    const deletadoEm  = new Date(p.deleted_at);
    const msRestantes = deletadoEm.getTime() + 7 * 86400000 - now;
    const dias        = Math.max(0, Math.ceil(msRestantes / 86400000));
    const urgente     = dias <= 2;
    const shortId     = p.id.slice(0, 8);

    return `
      <div class="hist-card" style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <div style="font-family:sans-serif;font-size:0.82rem;color:var(--text1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${jogadores}</div>
            <div style="font-family:sans-serif;font-size:0.75rem;color:var(--gold);margin-top:2px;">🏆 ${vencedor}</div>
            <div style="font-family:monospace;font-size:0.62rem;color:var(--text3);opacity:0.5;margin-top:3px;">#${shortId} · ${dataPartida}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:sans-serif;font-size:0.7rem;color:var(--text3);">
              Excluída em ${deletadoEm.toLocaleDateString('pt-BR')}
            </div>
            <div style="font-family:sans-serif;font-size:0.72rem;font-weight:600;color:${urgente ? '#f09080' : 'var(--text3)'};margin-top:2px;">
              ${dias === 0 ? '⚠ Apagada permanentemente hoje' : `⏱ ${dias} dia${dias !== 1 ? 's' : ''} até exclusão permanente`}
            </div>
          </div>
        </div>
        ${canRestore ? `
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px;">
            <button onclick="_restaurarPartida('${p.id}')" id="restBtn-${p.id}"
              style="background:rgba(74,143,48,0.12);color:#80d060;border:1px solid rgba(74,143,48,0.3);border-radius:var(--radius);padding:0.4rem 1rem;font-size:0.8rem;font-family:sans-serif;cursor:pointer;">
              ↩ Recuperar
            </button>
            <span id="restMsg-${p.id}" style="font-family:sans-serif;font-size:0.73rem;color:var(--text3);"></span>
          </div>` : ''}
      </div>`;
  }).join('');

  section.innerHTML = `
    <div class="section">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap;">
        <button onclick="carregarPartidasAdmin()"
          style="background:transparent;color:var(--text3);border:1px solid var(--border);border-radius:var(--radius);padding:0.35rem 0.8rem;font-size:0.82rem;font-family:sans-serif;cursor:pointer;">
          ← Voltar
        </button>
        <div class="section-title" style="margin:0;">🗑 Lixeira (${lista.length})</div>
      </div>
      ${lista.length === 0
        ? '<div style="text-align:center;padding:2rem;font-family:sans-serif;color:var(--text3);">Lixeira vazia.</div>'
        : `<p style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);margin-bottom:1rem;line-height:1.5;">
            Partidas excluídas são removidas permanentemente após 7 dias.
           </p>${cards}`}
    </div>`;
}

async function _restaurarPartida(id) {
  const btn  = document.getElementById('restBtn-' + id);
  const msg  = document.getElementById('restMsg-' + id);
  if (btn) btn.disabled = true;
  if (msg) { msg.style.color = 'var(--text3)'; msg.textContent = 'Restaurando...'; }

  try {
    const sb = await initSupabase();
    const { data: { session } } = await sb.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Sessão inválida');

    const res  = await fetch('/api/restaurar-partida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify({ partida_id: id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao restaurar');

    // Recarrega a lixeira
    _abrirLixeira();
  } catch (e) {
    if (btn) btn.disabled = false;
    if (msg) { msg.style.color = '#f09080'; msg.textContent = 'Erro: ' + e.message; }
  }
}
