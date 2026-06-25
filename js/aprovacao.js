// Painel de aprovação de partidas da liga (embaixadores)

let _aprovacaoData = [];

async function carregarAprovacoes() {
  const section = document.getElementById('tab-aprovacoes');
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
      .in('status', ['pendente_aprovacao', 'pendente_revisao'])
      .order('criado_em', { ascending: true });

    if (error) throw error;
    _aprovacaoData = data || [];
    _renderAprovacoes(section);
  } catch (e) {
    section.innerHTML = `<div class="section"><div style="text-align:center;padding:2rem;font-family:sans-serif;color:#f09080;">Erro: ${e.message}</div></div>`;
  }
}

function _renderAprovacoes(section) {
  if (!_aprovacaoData.length) {
    section.innerHTML = `
      <div class="section" style="text-align:center;padding:3rem 2rem;">
        <div style="font-size:2rem;margin-bottom:1rem;">✓</div>
        <div style="font-family:sans-serif;color:var(--text3);">Nenhuma partida aguardando aprovação.</div>
      </div>`;
    return;
  }

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Partidas Aguardando Revisão (${_aprovacaoData.length})</div>
      ${_aprovacaoData.map(p => _renderCardAprovacao(p)).join('')}
    </div>`;
}

function _renderCardAprovacao(p) {
  const d = p.dados || {};
  const jogadores = d.jogadores || [];
  let dataStr = '';
  if (d.data) {
    const parts = d.data.split('-');
    if (parts.length === 3) dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const statusBadge = p.status === 'pendente_revisao'
    ? '<span class="liga-badge badge-revisao">🔄 Em Revisão</span>'
    : '<span class="liga-badge badge-pendente">⏳ Aguardando</span>';

  const submitter = d.submitter_name || (p.user_id ? p.user_id.slice(0, 8) + '...' : '—');

  return `
    <div class="hist-card" id="card-aprov-${p.id}">
      <div class="hist-card-header">
        <span class="hist-local">${d.local || '—'}</span>
        <span class="hist-data">${dataStr}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin:4px 0;">
        ${statusBadge}
        <span style="font-family:sans-serif;font-size:0.73rem;color:var(--text3);">por ${submitter}</span>
      </div>
      ${d.mapa ? `<div class="hist-mapa">🗺️ ${d.mapa}</div>` : ''}
      <div class="hist-jogadores">
        ${jogadores.map(j => `
          <span class="hist-jogador${j.vencedor ? ' hist-vencedor-tag' : ''}">
            ${j.nome}${j.faccao ? ' · ' + j.faccao : ''}${j.pontuacao != null ? ' · ' + j.pontuacao + 'pts' : ''}
          </span>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        ${p.foto_pontuacao_url ? `<button onclick="_verFoto('${p.foto_pontuacao_url}','📸 Pontuação')" class="btn-copiar" style="font-size:0.72rem;cursor:pointer;">📸 Pontuação</button>` : ''}
        ${p.foto_jogadores_url ? `<button onclick="_verFoto('${p.foto_jogadores_url}','👥 Jogadores')" class="btn-copiar" style="font-size:0.72rem;cursor:pointer;">👥 Jogadores</button>` : ''}
      </div>
      ${p.nota_embaixador ? `
        <div style="margin-top:8px;padding:8px 10px;background:var(--surface2);border-radius:8px;font-family:sans-serif;font-size:0.78rem;color:var(--text2);">
          <strong style="color:var(--text3);">Nota anterior:</strong> ${p.nota_embaixador}
        </div>` : ''}
      <div class="aprov-actions" id="aprov-actions-${p.id}">
        <button class="btn-liga" style="background:var(--green);font-size:0.82rem;padding:0.5rem 1rem;" onclick="aprovarPartida('${p.id}')">✓ Aprovar</button>
        <button class="btn-liga" style="background:var(--blue-bg);border:1px solid rgba(48,112,200,0.5);color:#70a8f0;font-size:0.82rem;padding:0.5rem 1rem;" onclick="iniciarAcaoAprov('${p.id}','revisao')">🔄 Solicitar Revisão</button>
        <button class="btn-liga" style="background:var(--red-bg);border:1px solid rgba(200,64,40,0.5);color:#f08070;font-size:0.82rem;padding:0.5rem 1rem;" onclick="iniciarAcaoAprov('${p.id}','reprovada')">✗ Reprovar</button>
      </div>
      <div id="aprov-nota-${p.id}" style="display:none;margin-top:10px;">
        <textarea id="aprov-nota-text-${p.id}" placeholder="Nota para o jogador (opcional)" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--text);font-family:sans-serif;font-size:0.85rem;min-height:80px;resize:vertical;box-sizing:border-box;"></textarea>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button id="aprov-confirm-${p.id}" class="btn-liga" style="font-size:0.82rem;padding:0.5rem 1rem;">Confirmar</button>
          <button class="btn-copiar" style="font-size:0.82rem;" onclick="_cancelarAcaoAprov('${p.id}')">Cancelar</button>
        </div>
      </div>
    </div>`;
}

function iniciarAcaoAprov(id, acao) {
  const actionsDiv = document.getElementById('aprov-actions-' + id);
  const notaDiv    = document.getElementById('aprov-nota-' + id);
  const confirmBtn = document.getElementById('aprov-confirm-' + id);
  if (!notaDiv || !actionsDiv) return;

  actionsDiv.style.display = 'none';
  notaDiv.style.display = 'block';

  if (acao === 'revisao') {
    confirmBtn.textContent = 'Solicitar Revisão';
    confirmBtn.setAttribute('style', 'font-size:0.82rem;padding:0.5rem 1rem;background:var(--blue-bg);border:1px solid rgba(48,112,200,0.5);color:#70a8f0;');
    confirmBtn.onclick = () => _confirmarAcaoAprov(id, 'pendente_revisao');
  } else {
    confirmBtn.textContent = 'Confirmar Reprovação';
    confirmBtn.setAttribute('style', 'font-size:0.82rem;padding:0.5rem 1rem;background:var(--red-bg);border:1px solid rgba(200,64,40,0.5);color:#f08070;');
    confirmBtn.onclick = () => _confirmarAcaoAprov(id, 'reprovada');
  }
}

function _cancelarAcaoAprov(id) {
  const notaDiv    = document.getElementById('aprov-nota-' + id);
  const actionsDiv = document.getElementById('aprov-actions-' + id);
  if (notaDiv)    notaDiv.style.display = 'none';
  if (actionsDiv) actionsDiv.style.display = 'flex';
}

async function aprovarPartida(id) {
  await _atualizarStatusPartida(id, { status: 'aprovada', aprovado_por: currentUser.id });
}

async function _confirmarAcaoAprov(id, novoStatus) {
  const nota = document.getElementById('aprov-nota-text-' + id)?.value?.trim() || null;
  const updates = { status: novoStatus, nota_embaixador: nota };
  if (novoStatus === 'reprovada') updates.aprovado_por = currentUser.id;
  await _atualizarStatusPartida(id, updates);
}

async function _atualizarStatusPartida(id, updates) {
  const card = document.getElementById('card-aprov-' + id);
  if (card) card.style.opacity = '0.6';
  try {
    const sb = await initSupabase();
    const { error } = await sb.from('partidas_liga')
      .update({ ...updates, atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    if (card) card.remove();
    _aprovacaoData = _aprovacaoData.filter(p => p.id !== id);
    if (!_aprovacaoData.length) {
      const section = document.getElementById('tab-aprovacoes');
      if (section) section.innerHTML = `
        <div class="section" style="text-align:center;padding:3rem 2rem;">
          <div style="font-size:2rem;margin-bottom:1rem;">✓</div>
          <div style="font-family:sans-serif;color:var(--text3);">Nenhuma partida aguardando aprovação.</div>
        </div>`;
    }
  } catch (e) {
    if (card) card.style.opacity = '1';
    alert('Erro: ' + e.message);
  }
}
