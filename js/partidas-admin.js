// Listagem de todas as partidas para admin/super_user

let _partidasAdminData = [];

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
      .order('criado_em', { ascending: false });
    if (error) throw error;
    _partidasAdminData = data || [];
    _renderPartidasAdmin(section);
  } catch (e) {
    section.innerHTML = `<div class="section"><div style="text-align:center;padding:2rem;font-family:sans-serif;color:#f09080;">Erro: ${e.message}</div></div>`;
  }
}

function _renderPartidasAdmin(section) {
  if (!_partidasAdminData.length) {
    section.innerHTML = `
      <div class="section" style="text-align:center;padding:3rem 2rem;">
        <div style="font-size:2rem;margin-bottom:1rem;">📋</div>
        <div style="font-family:sans-serif;color:var(--text3);">Nenhuma partida registrada.</div>
      </div>`;
    return;
  }

  const rows = _partidasAdminData.map(p => {
    const d         = p.dados || {};
    const jogadores = (d.jogadores || []).map(j => j.nome).join(', ') || '—';
    const vencedor  = d.vencedor?.nome || '—';
    const data      = p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—';
    const badge     = _PA_STATUS_BADGE[p.status] || '';

    return `
      <tr onclick="_abrirDetalhePartida('${p.id}')"
          style="cursor:pointer;transition:background 0.15s;"
          onmouseover="this.style.background='var(--surface2)'"
          onmouseout="this.style.background=''">
        <td style="padding:10px 8px;font-family:sans-serif;font-size:0.8rem;color:var(--text3);white-space:nowrap;">${data}</td>
        <td style="padding:10px 8px;font-family:sans-serif;font-size:0.8rem;color:var(--text2);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.submitter_name || '—'}</td>
        <td style="padding:10px 8px;font-family:sans-serif;font-size:0.8rem;color:var(--text1);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${jogadores}">${jogadores}</td>
        <td style="padding:10px 8px;font-family:sans-serif;font-size:0.8rem;color:var(--gold);white-space:nowrap;">🏆 ${vencedor}</td>
        <td style="padding:10px 8px;">${badge}</td>
      </tr>`;
  }).join('');

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Todas as Partidas (${_partidasAdminData.length})</div>
      <div style="overflow-x:auto;border-radius:var(--radius);border:1px solid var(--border);">
        <table style="width:100%;border-collapse:collapse;min-width:520px;">
          <thead>
            <tr style="border-bottom:1px solid var(--border2);">
              <th style="padding:8px 8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;white-space:nowrap;">Data</th>
              <th style="padding:8px 8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Enviado por</th>
              <th style="padding:8px 8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Jogadores</th>
              <th style="padding:8px 8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Vencedor</th>
              <th style="padding:8px 8px;font-family:sans-serif;font-size:0.72rem;color:var(--text3);text-align:left;font-weight:600;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function _abrirDetalhePartida(id) {
  const p = _partidasAdminData.find(x => x.id === id);
  if (!p) return;
  const d         = p.dados || {};
  const jogadores = d.jogadores || [];
  const dataStr   = d.data     || (p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—');
  const badge     = _PA_STATUS_BADGE[p.status] || '';

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

  const listaJogadores = jogadores.map(j => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-family:sans-serif;font-size:0.8rem;">
      <span style="color:${j.vencedor ? 'var(--gold)' : 'var(--text1)'};">${j.vencedor ? '🏆 ' : ''}${j.nome}${j.faccao ? ' · ' + j.faccao : ''}</span>
      ${j.pontuacao != null ? `<span style="color:var(--text3);">${j.pontuacao} pts</span>` : ''}
    </div>`).join('');

  const box = document.getElementById('modalPartidaDetalheBox');
  box.innerHTML = `
    <button class="auth-close" onclick="_fecharDetalhePartida()">✕</button>
    <div style="font-family:sans-serif;font-size:1rem;font-weight:700;color:var(--text1);margin-bottom:4px;">Detalhes da Partida</div>
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

    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
      <button onclick="_confirmarApagarPartida('${p.id}')"
        style="width:100%;background:rgba(200,60,40,0.15);color:#f08070;border:1px solid rgba(200,60,40,0.3);border-radius:var(--radius);padding:0.5rem 1rem;font-family:sans-serif;font-size:0.82rem;font-weight:600;cursor:pointer;">
        🗑 Apagar esta partida
      </button>
      <div id="modalPartidaMsg" style="font-family:sans-serif;font-size:0.75rem;text-align:center;margin-top:6px;"></div>
    </div>`;

  const modal = document.getElementById('modalPartidaDetalhe');
  modal.style.display = 'flex';
}

function _fecharDetalhePartida() {
  const modal = document.getElementById('modalPartidaDetalhe');
  if (modal) modal.style.display = 'none';
}

function _confirmarApagarPartida(id) {
  const ok = confirm('Tem certeza que deseja apagar esta partida? Esta ação não pode ser desfeita.');
  if (!ok) return;
  _apagarPartida(id);
}

async function _apagarPartida(id) {
  const msg = document.getElementById('modalPartidaMsg');
  if (msg) { msg.style.color = 'var(--text3)'; msg.textContent = 'Apagando...'; }

  try {
    const sb = await initSupabase();
    const { data: { session } } = await sb.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Sessão inválida');

    const res = await fetch('/api/apagar-partida', {
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
