// Histórico de partidas

async function carregarHistorico() {
  const section = document.getElementById('tab-historico');
  if (!section) return;

  const user = typeof currentUser !== 'undefined' ? currentUser : null;
  if (!user) {
    renderHistoricoLogout();
    return;
  }

  section.innerHTML = `
    <div class="section" style="text-align:center;padding:2rem;">
      <div style="font-family:sans-serif;color:var(--text3);font-size:0.88rem;">Carregando histórico...</div>
    </div>`;

  try {
    const sb = await initSupabase();
    const { data, error } = await sb
      .from('historico')
      .select('*')
      .eq('user_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(50);

    if (error) {
      const msg = error.code === '42P01'
        ? 'A tabela de histórico ainda não foi configurada no banco de dados.'
        : 'Erro ao carregar histórico: ' + error.message;
      renderHistoricoMensagem(section, '📭', msg);
      return;
    }

    renderHistoricoData(section, data || []);
    // Carrega em paralelo sem bloquear o histórico principal
    carregarHistoricoLudopedia(section);
    carregarPartidasLiga(section);
  } catch (e) {
    renderHistoricoMensagem(section, '⚠️', 'Erro de conexão ao carregar histórico.');
    console.warn('Historico error:', e);
  }
}

async function carregarHistoricoLudopedia(section) {
  if (typeof buscarPartidasLudo !== 'function') return;
  if (typeof ludoToken === 'undefined' || !ludoToken) return;

  // Placeholder enquanto carrega
  const placeholder = document.createElement('div');
  placeholder.id = 'ludoHistSection';
  placeholder.innerHTML = `<div style="font-family:sans-serif;font-size:0.8rem;color:var(--text3);padding:1rem 0;text-align:center;">⏳ Carregando partidas da Ludopedia...</div>`;
  section.appendChild(placeholder);

  try {
    const partidas = await buscarPartidasLudo();
    const el = document.getElementById('ludoHistSection');
    if (!el) return;

    if (!partidas.length) {
      el.remove();
      return;
    }

    el.innerHTML = `
      <div class="section" style="margin-top:1rem;">
        <div class="section-title" style="display:flex;align-items:center;gap:8px;">
          <span>🎲</span> Partidas de Root na Ludopedia (${partidas.length})
        </div>
        ${partidas.map(p => renderCardLudoPartida(p)).join('')}
      </div>`;
  } catch (e) {
    const el = document.getElementById('ludoHistSection');
    if (el) el.remove();
    console.warn('Erro partidas Ludopedia:', e);
  }
}

function _parseLudoObs(obs) {
  if (!obs) return '';
  // Ludopedia guarda dados internos como "_ldh_id_{json}" — extrai só a facção
  if (obs.startsWith('_ldh_id_')) {
    try {
      const d = JSON.parse(obs.slice(8));
      return d['facção'] || d.faccao || '';
    } catch { return ''; }
  }
  return obs;
}

function _nomeExibicaoLudo(j) {
  // Prefere o nome real dentro do JSON interno, senão usa j.nome
  if (j.observacao && j.observacao.startsWith('_ldh_id_')) {
    try {
      const d = JSON.parse(j.observacao.slice(8));
      if (d.nome) return d.nome;
    } catch {}
  }
  return j.nome || '—';
}

function renderCardLudoPartida(p) {
  const jogadores = p.jogadores || [];
  const vencedor  = jogadores.find(j => j.fl_vencedor === 1);

  const parts   = (p.dt_partida || '').split('-');
  const dataStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '';
  const durStr  = p.duracao ? `⏱ ${p.duracao}min` : '';

  const nomeVenc   = vencedor ? _nomeExibicaoLudo(vencedor) : '';
  const faccaoVenc = vencedor ? _parseLudoObs(vencedor.observacao) : '';

  return `
    <div class="hist-card ludo-hist-card">
      <div class="hist-card-header">
        <span class="hist-local">🎲 Ludopedia</span>
        <span class="hist-data">${dataStr}${durStr ? ' · ' + durStr : ''}</span>
      </div>
      ${vencedor ? `<div class="hist-vencedor">🏆 ${nomeVenc}${faccaoVenc ? ' — ' + faccaoVenc : ''}</div>` : ''}
      <div class="hist-jogadores">
        ${jogadores.map(j => {
          const nome   = _nomeExibicaoLudo(j);
          const faccao = _parseLudoObs(j.observacao);
          return `<span class="hist-jogador${j.fl_vencedor ? ' hist-vencedor-tag' : ''}">
            ${nome}${faccao ? ' · ' + faccao : ''}${j.vl_pontos != null ? ' · ' + j.vl_pontos + 'pts' : ''}
          </span>`;
        }).join('')}
      </div>
      <div style="margin-top:10px;">
        <a href="https://ludopedia.com.br/partida?id_partida=${p.id_partida}" target="_blank"
           class="btn-copiar" style="display:inline-block;text-decoration:none;font-size:0.75rem;">
          🎲 Ver na Ludopedia ↗
        </a>
      </div>
    </div>`;
}

function renderHistoricoLogout() {
  const section = document.getElementById('tab-historico');
  if (!section) return;
  section.innerHTML = `
    <div class="section" style="text-align:center;padding:3rem 2rem;">
      <div style="font-size:2.5rem;margin-bottom:1rem;">📋</div>
      <div style="font-size:1rem;color:var(--text2);font-family:sans-serif;margin-bottom:0.5rem;">Faça login para ver seu histórico</div>
      <div style="font-size:0.82rem;color:var(--text3);font-family:sans-serif;line-height:1.5;">
        Suas partidas são salvas automaticamente ao gerar um resultado para a liga.
      </div>
      <button class="btn-liga" onclick="showAuthModal()" style="max-width:220px;margin:1.5rem auto 0;display:block;">🔐 Entrar</button>
    </div>`;
}

function renderHistoricoMensagem(section, icon, msg) {
  section.innerHTML = `
    <div class="section" style="text-align:center;padding:2.5rem 2rem;">
      <div style="font-size:2rem;margin-bottom:1rem;">${icon}</div>
      <div style="font-size:0.88rem;color:var(--text3);font-family:sans-serif;line-height:1.5;">${msg}</div>
    </div>`;
}

function renderHistoricoData(section, data) {
  _historicoData = data;
  if (!data.length) {
    section.innerHTML = `
      <div class="section" style="text-align:center;padding:3rem 2rem;">
        <div style="font-size:2.5rem;margin-bottom:1rem;">📋</div>
        <div style="font-size:1rem;color:var(--text2);font-family:sans-serif;">Nenhuma partida registrada ainda</div>
        <div style="font-size:0.82rem;color:var(--text3);font-family:sans-serif;margin-top:0.5rem;line-height:1.5;">
          Gere um resultado na aba 🏆 Liga para salvar automaticamente.
        </div>
      </div>`;
    return;
  }

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Histórico de Partidas (${data.length})</div>
      ${data.map(entry => renderHistoricoCard(entry)).join('')}
    </div>`;
}

function formatarResultadoHistorico(d) {
  const jogadores = d.jogadores || [];
  let dataStr = '';
  if (d.data) {
    const parts = d.data.split('-');
    if (parts.length === 3) dataStr = `${parts[2]}/${parts[1]}`;
  }

  let header = d.local || '';
  if (dataStr) header += (header ? ' ' : '') + dataStr;
  if (d.mapa) header += (header ? ' | Mapa ' : 'Mapa ') + d.mapa;

  const lines = [header];
  jogadores.forEach(j => {
    let line = j.nome;
    if (j.iniciante) line += ' (Iniciante)';
    line += ' - ' + j.faccao;
    if (j.pontuacao == null) {
      line += j.vencedor ? ' Vitória por Domínio' : ' Derrota por Domínio';
    } else {
      line += ' ' + j.pontuacao;
    }
    lines.push(line);
  });

  return lines.join('\n');
}

function compartilharHistoricoWhatsApp(id) {
  const entry = _historicoData?.find(e => e.id === id);
  if (!entry) return;
  const text = formatarResultadoHistorico(entry.dados || {});
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

let _historicoData = [];
let _ligaPartidasData = [];

// ── Partidas submetidas para a liga ──────────────────────────────

async function carregarPartidasLiga(section) {
  const user = typeof currentUser !== 'undefined' ? currentUser : null;
  if (!user) return;

  const placeholder = document.createElement('div');
  placeholder.id = 'ligaPartidasSection';
  section.appendChild(placeholder);

  try {
    const sb = await initSupabase();
    const { data, error } = await sb
      .from('partidas_liga')
      .select('*')
      .eq('user_id', user.id)
      .order('criado_em', { ascending: false })
      .limit(20);

    const el = document.getElementById('ligaPartidasSection');
    if (!el) return;

    if (error || !data?.length) { el.remove(); return; }

    _ligaPartidasData = data;
    el.innerHTML = `
      <div class="section" style="margin-top:1rem;">
        <div class="section-title">Minhas Partidas na Liga (${data.length})</div>
        ${data.map(p => _renderCardLigaPartida(p)).join('')}
      </div>`;
  } catch {
    const el = document.getElementById('ligaPartidasSection');
    if (el) el.remove();
  }
}

const _LIGA_STATUS_BADGE = {
  pendente_aprovacao: '<span class="liga-badge badge-pendente">⏳ Aguardando aprovação</span>',
  pendente_revisao:   '<span class="liga-badge badge-revisao">🔄 Pendente revisão</span>',
  aprovada:           '<span class="liga-badge badge-aprovada">✓ Aprovada</span>',
  reprovada:          '<span class="liga-badge badge-reprovada">✗ Reprovada</span>',
};

function _renderCardLigaPartida(p) {
  const d = p.dados || {};
  const jogadores = d.jogadores || [];
  const vencedor  = jogadores.find(j => j.vencedor);

  let dataStr = '';
  if (d.data) {
    const parts = d.data.split('-');
    if (parts.length === 3) dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const badge      = _LIGA_STATUS_BADGE[p.status] || '';
  const podeEditar = p.status === 'pendente_revisao';

  return `
    <div class="hist-card">
      <div class="hist-card-header">
        <span class="hist-local">${d.local || '—'}</span>
        <span class="hist-data">${dataStr}</span>
      </div>
      ${badge}
      ${d.mapa ? `<div class="hist-mapa">🗺️ ${d.mapa}</div>` : ''}
      ${vencedor ? `<div class="hist-vencedor">🏆 ${vencedor.nome} — ${vencedor.faccao}</div>` : ''}
      <div class="hist-jogadores">
        ${jogadores.map(j => `
          <span class="hist-jogador${j.vencedor ? ' hist-vencedor-tag' : ''}">
            ${j.nome}${j.faccao ? ' · ' + j.faccao : ''}${j.pontuacao != null ? ' · ' + j.pontuacao + 'pts' : ''}
          </span>`).join('')}
      </div>
      ${p.nota_embaixador ? `
        <div style="margin-top:8px;padding:8px 10px;background:var(--surface2);border-radius:8px;font-family:sans-serif;font-size:0.78rem;color:var(--text2);line-height:1.4;">
          <strong style="color:var(--text3);">Nota do embaixador:</strong> ${p.nota_embaixador}
        </div>` : ''}
      ${podeEditar ? `
        <div style="margin-top:10px;">
          <button class="btn-liga" style="font-size:0.82rem;padding:0.5rem 1rem;" onclick="_editarPorId('${p.id}')">✏ Editar e Reenviar</button>
        </div>` : ''}
    </div>`;
}

function _editarPorId(id) {
  const p = _ligaPartidasData.find(x => x.id === id);
  if (!p) return;
  if (typeof editarPartidaRevisao === 'function') {
    editarPartidaRevisao(p.id, p.dados, p.nota_embaixador);
  }
}

function renderHistoricoCard(entry) {
  const d = entry.dados || {};
  const jogadores = d.jogadores || [];
  const vencedor = jogadores.find(j => j.vencedor);

  let dataStr = '';
  if (d.data) {
    const parts = d.data.split('-');
    if (parts.length === 3) dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return `
    <div class="hist-card">
      <div class="hist-card-header">
        <span class="hist-local">${d.local || '—'}</span>
        <span class="hist-data">${dataStr}</span>
      </div>
      ${d.mapa ? `<div class="hist-mapa">🗺️ ${d.mapa}</div>` : ''}
      ${vencedor ? `<div class="hist-vencedor">🏆 ${vencedor.nome} — ${vencedor.faccao}</div>` : ''}
      <div class="hist-jogadores">
        ${jogadores.map(j => `
          <span class="hist-jogador${j.vencedor ? ' hist-vencedor-tag' : ''}">
            ${j.nome}${j.faccao ? ' · ' + j.faccao : ''}${j.pontuacao != null ? ' · ' + j.pontuacao + 'pts' : ''}
          </span>
        `).join('')}
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button class="btn-copiar" onclick="compartilharHistoricoWhatsApp('${entry.id}')" style="background:#25D366;color:white;font-size:0.75rem;">
          📲 WhatsApp
        </button>
        ${d.ludopedia_id ? `
        <a href="https://ludopedia.com.br/partida?id_partida=${d.ludopedia_id}" target="_blank"
           class="btn-copiar" style="display:inline-block;text-decoration:none;font-size:0.75rem;background:rgba(74,143,48,0.15);border:1px solid rgba(74,143,48,0.4);color:#80d060;">
          🎲 Ver na Ludopedia ↗
        </a>` : ''}
      </div>
    </div>`;
}
