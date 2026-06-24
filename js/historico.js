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
    const [histRes, ligaRes] = await Promise.all([
      sb.from('historico').select('*').eq('user_id', user.id).order('criado_em', { ascending: false }).limit(50),
      sb.from('partidas_liga').select('*').eq('user_id', user.id).order('criado_em', { ascending: false }).limit(50),
    ]);

    if (histRes.error) {
      const msg = histRes.error.code === '42P01'
        ? 'A tabela de histórico ainda não foi configurada no banco de dados.'
        : 'Erro ao carregar histórico: ' + histRes.error.message;
      renderHistoricoMensagem(section, '📭', msg);
      return;
    }

    _ligaPartidasData = ligaRes.data || [];

    // Mapa: historico_id → partida_liga (para partidas submetidas via historico)
    const ligaLookup = {};
    _ligaPartidasData.forEach(p => {
      if (p.dados?.historico_id) ligaLookup[p.dados.historico_id] = p;
    });

    renderHistoricoData(section, histRes.data || [], ligaLookup);
    _renderLigaPartidasSection(section);
    _carregarPartidasComoParticipante(section, user, sb);
    carregarHistoricoLudopedia(section);
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

function renderHistoricoData(section, data, ligaLookup = {}) {
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
      ${data.map(entry => renderHistoricoCard(entry, ligaLookup[entry.id] || null)).join('')}
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

// ── Fotos da partida ─────────────────────────────────────────────

function _renderFotosLiga(p) {
  if (!p?.foto_pontuacao_url && !p?.foto_jogadores_url) return '';
  return `
    <div style="display:flex;gap:8px;margin-top:10px;">
      ${p.foto_pontuacao_url ? `
        <a href="${p.foto_pontuacao_url}" target="_blank" rel="noopener"
           style="flex:1;display:block;border-radius:6px;overflow:hidden;border:1px solid var(--border);text-decoration:none;">
          <img src="${p.foto_pontuacao_url}" loading="lazy"
               style="width:100%;height:80px;object-fit:cover;display:block;">
          <div style="font-family:sans-serif;font-size:0.68rem;color:var(--text3);text-align:center;padding:3px 0;">📸 Pontuação</div>
        </a>` : ''}
      ${p.foto_jogadores_url ? `
        <a href="${p.foto_jogadores_url}" target="_blank" rel="noopener"
           style="flex:1;display:block;border-radius:6px;overflow:hidden;border:1px solid var(--border);text-decoration:none;">
          <img src="${p.foto_jogadores_url}" loading="lazy"
               style="width:100%;height:80px;object-fit:cover;display:block;">
          <div style="font-family:sans-serif;font-size:0.68rem;color:var(--text3);text-align:center;padding:3px 0;">👥 Jogadores</div>
        </a>` : ''}
    </div>`;
}

// ── Status badges ────────────────────────────────────────────────

const _LIGA_STATUS_BADGE = {
  pendente_aprovacao: '<span class="liga-badge badge-pendente">⏳ Aguardando aprovação</span>',
  pendente_revisao:   '<span class="liga-badge badge-revisao">🔄 Pendente revisão</span>',
  aprovada:           '<span class="liga-badge badge-aprovada">✓ Aprovada</span>',
  reprovada:          '<span class="liga-badge badge-reprovada">✗ Reprovada</span>',
  nao_submetida:      '<span class="liga-badge badge-nao-submetida">○ Não submetida</span>',
};

function renderHistoricoCard(entry, ligaPartida) {
  const d = entry.dados || {};
  const jogadores = d.jogadores || [];
  const vencedor = jogadores.find(j => j.vencedor);

  let dataStr = '';
  if (d.data) {
    const parts = d.data.split('-');
    if (parts.length === 3) dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  let statusBadge = '';
  let actionBtn = '';

  if (ligaPartida) {
    statusBadge = _LIGA_STATUS_BADGE[ligaPartida.status] || '';
    if (ligaPartida.status === 'pendente_revisao') {
      actionBtn = `
        <div style="margin-top:10px;">
          <button class="btn-liga" style="font-size:0.82rem;padding:0.5rem 1rem;" onclick="_editarPorId('${ligaPartida.id}')">✏ Editar e Reenviar</button>
        </div>`;
    }
  } else {
    statusBadge = _LIGA_STATUS_BADGE.nao_submetida;
    actionBtn = `
      <div style="margin-top:10px;">
        <button class="btn-liga" style="font-size:0.82rem;padding:0.5rem 1rem;" onclick="_abrirUploadHistorico('${entry.id}')">📤 Submeter para Liga</button>
      </div>`;
  }

  return `
    <div class="hist-card">
      <div class="hist-card-header">
        <span class="hist-local">${d.local || '—'}</span>
        <span class="hist-data">${dataStr}</span>
      </div>
      ${statusBadge}
      ${d.mapa ? `<div class="hist-mapa">🗺️ ${d.mapa}</div>` : ''}
      ${vencedor ? `<div class="hist-vencedor">🏆 ${vencedor.nome} — ${vencedor.faccao}</div>` : ''}
      <div class="hist-jogadores">
        ${jogadores.map(j => `
          <span class="hist-jogador${j.vencedor ? ' hist-vencedor-tag' : ''}">
            ${j.nome}${j.faccao ? ' · ' + j.faccao : ''}${j.pontuacao != null ? ' · ' + j.pontuacao + 'pts' : ''}
          </span>
        `).join('')}
      </div>
      ${ligaPartida?.nota_embaixador ? `
        <div style="margin-top:8px;padding:8px 10px;background:var(--surface2);border-radius:8px;font-family:sans-serif;font-size:0.78rem;color:var(--text2);line-height:1.4;">
          <strong style="color:var(--text3);">Nota do embaixador:</strong> ${ligaPartida.nota_embaixador}
        </div>` : ''}
      ${_renderFotosLiga(ligaPartida)}
      ${actionBtn}
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

// ── Partidas submetidas para a liga ──────────────────────────────

function _renderLigaPartidasSection(section) {
  document.getElementById('ligaPartidasSection')?.remove();
  if (!_ligaPartidasData.length) return;

  const div = document.createElement('div');
  div.id = 'ligaPartidasSection';
  div.innerHTML = `
    <div class="section" style="margin-top:1rem;">
      <div class="section-title">Minhas Partidas na Liga (${_ligaPartidasData.length})</div>
      ${_ligaPartidasData.map(p => _renderCardLigaPartida(p)).join('')}
    </div>`;
  section.appendChild(div);
}

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
      ${_renderFotosLiga(p)}
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

// ── Upload de partida do histórico para a liga ───────────────────

let _histUploadPontuacao = null;
let _histUploadJogadores = null;
let _histEntrySubmitting = null;

function _abrirUploadHistorico(entryId) {
  if (!currentUser) { showAuthModal(); return; }
  const entry = _historicoData.find(e => e.id === entryId);
  if (!entry) return;

  _histEntrySubmitting = entry;
  _histUploadPontuacao = null;
  _histUploadJogadores = null;

  const d = entry.dados || {};
  const jogadores = d.jogadores || [];

  let modal = document.getElementById('modalUploadHistorico');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalUploadHistorico';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;';
    document.body.appendChild(modal);
  }

  let dataStr = '';
  if (d.data) {
    const parts = d.data.split('-');
    if (parts.length === 3) dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const vencedor = jogadores.find(j => j.vencedor);

  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;max-width:420px;width:92%;max-height:90vh;overflow-y:auto;font-family:sans-serif;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <span style="font-size:0.95rem;font-weight:600;color:var(--gold);">📤 Submeter para Liga</span>
        <button onclick="document.getElementById('modalUploadHistorico').style.display='none'" style="background:none;border:none;color:var(--text3);font-size:1.5rem;cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.25rem;">
        <strong>${d.local || '—'}</strong>${dataStr ? ' · ' + dataStr : ''}${d.mapa ? ' · Mapa ' + d.mapa : ''}
      </div>
      ${vencedor ? `<div style="font-size:0.78rem;color:var(--gold);margin-bottom:0.75rem;">🏆 ${vencedor.nome} — ${vencedor.faccao}</div>` : ''}
      <p style="font-size:0.78rem;color:var(--text3);margin-bottom:1rem;line-height:1.5;">
        Envie as fotos obrigatórias para que o embaixador possa aprovar a partida.
      </p>
      <p style="font-family:sans-serif;font-size:0.72rem;color:var(--text3);margin-bottom:1rem;line-height:1.5;display:flex;align-items:flex-start;gap:5px;">
        <span style="flex-shrink:0;">🤖</span>
        <span>As fotos são verificadas automaticamente por IA. Conteúdo sexual, violento ou impróprio é bloqueado antes do envio.</span>
      </p>
      <div class="upload-area-wrap">
        <div class="upload-area" id="histUploadAreaPontuacao" onclick="document.getElementById('histInpFotoPontuacao').click()">
          <div id="histPreviewPontuacao" class="upload-preview">
            <div class="upload-icon">📸</div>
            <div class="upload-label">Foto da Pontuação</div>
            <div class="upload-hint">Toque para selecionar</div>
          </div>
          <input type="file" id="histInpFotoPontuacao" accept="image/*" style="display:none" onchange="_histOnFotoSelect('pontuacao',this)">
        </div>
        <div class="upload-area" id="histUploadAreaJogadores" onclick="document.getElementById('histInpFotoJogadores').click()">
          <div id="histPreviewJogadores" class="upload-preview">
            <div class="upload-icon">👥</div>
            <div class="upload-label">Foto dos Jogadores</div>
            <div class="upload-hint">Toque para selecionar</div>
          </div>
          <input type="file" id="histInpFotoJogadores" accept="image/*" style="display:none" onchange="_histOnFotoSelect('jogadores',this)">
        </div>
      </div>
      <button id="btnHistEnviarLiga" class="btn-liga" onclick="_enviarHistoricoParaLiga()" disabled style="margin-top:1rem;opacity:0.5;">📤 Enviar para Aprovação</button>
      <div id="histUploadStatus" style="font-size:0.82rem;min-height:20px;margin-top:8px;text-align:center;color:var(--text3);"></div>
    </div>`;
  modal.style.display = 'flex';
}

function _histOnFotoSelect(tipo, input) {
  const file = input.files[0];
  if (!file) return;
  if (tipo === 'pontuacao') _histUploadPontuacao = file;
  else _histUploadJogadores = file;

  const previewId = tipo === 'pontuacao' ? 'histPreviewPontuacao' : 'histPreviewJogadores';
  const areaId    = tipo === 'pontuacao' ? 'histUploadAreaPontuacao' : 'histUploadAreaJogadores';
  const preview   = document.getElementById(previewId);
  const area      = document.getElementById(areaId);

  if (preview) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;pointer-events:none;">`;
    };
    reader.readAsDataURL(file);
  }
  if (area) area.classList.add('has-image');

  const btn = document.getElementById('btnHistEnviarLiga');
  if (btn) {
    const ok = _histUploadPontuacao && _histUploadJogadores;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '1' : '0.5';
  }
}

async function _enviarHistoricoParaLiga() {
  if (!_histUploadPontuacao || !_histUploadJogadores || !_histEntrySubmitting) return;
  if (!currentUser) { showAuthModal(); return; }

  const btn    = document.getElementById('btnHistEnviarLiga');
  const status = document.getElementById('histUploadStatus');
  if (btn) btn.disabled = true;
  if (status) { status.style.color = 'var(--gold)'; status.textContent = 'Enviando fotos...'; }

  try {
    const sb      = await initSupabase();
    const uid     = currentUser.id;
    const matchId = crypto.randomUUID();
    const path1   = `${uid}/${matchId}/pontuacao.jpg`;
    const path2   = `${uid}/${matchId}/jogadores.jpg`;

    const blob1 = await _comprimirImagem(_histUploadPontuacao);
    const blob2 = await _comprimirImagem(_histUploadJogadores);

    const { error: e1 } = await sb.storage.from('fotos-partidas').upload(path1, blob1, { upsert: true, contentType: 'image/jpeg' });
    if (e1) throw e1;
    if (status) status.textContent = 'Enviando segunda foto...';

    const { error: e2 } = await sb.storage.from('fotos-partidas').upload(path2, blob2, { upsert: true, contentType: 'image/jpeg' });
    if (e2) throw e2;

    const { data: d1 } = sb.storage.from('fotos-partidas').getPublicUrl(path1);
    const { data: d2 } = sb.storage.from('fotos-partidas').getPublicUrl(path2);

    if (status) status.textContent = 'Verificando fotos...';
    const { data: { session } } = await sb.auth.getSession();
    const jwt = session?.access_token;
    const [mod1, mod2] = await Promise.all([
      _checarFotoMod(jwt, d1.publicUrl),
      _checarFotoMod(jwt, d2.publicUrl),
    ]);
    if (!mod1.ok) {
      await sb.storage.from('fotos-partidas').remove([path1, path2]);
      throw new Error(mod1.reason || 'Foto de pontuação reprovada na moderação.');
    }
    if (!mod2.ok) {
      await sb.storage.from('fotos-partidas').remove([path1, path2]);
      throw new Error(mod2.reason || 'Foto de jogadores reprovada na moderação.');
    }

    if (status) status.textContent = 'Registrando partida...';

    const nomeUser = currentUser.user_metadata?.display_name
      || currentUser.user_metadata?.full_name
      || currentUser.email?.split('@')[0] || 'Usuário';

    const dadosFinais = {
      ..._histEntrySubmitting.dados,
      historico_id: _histEntrySubmitting.id,
      submitter_name: nomeUser,
    };

    const { error: e3 } = await sb.from('partidas_liga').insert({
      id: matchId,
      user_id: uid,
      status: 'pendente_aprovacao',
      dados: dadosFinais,
      foto_pontuacao_url: d1.publicUrl,
      foto_jogadores_url: d2.publicUrl,
    });
    if (e3) throw e3;

    if (status) { status.style.color = '#80d060'; status.textContent = '✓ Partida enviada! Aguardando aprovação do embaixador.'; }
    if (btn) { btn.textContent = '✓ Enviado'; btn.style.opacity = '1'; }

    // Fecha modal e recarrega histórico para refletir o novo status
    setTimeout(() => {
      const modal = document.getElementById('modalUploadHistorico');
      if (modal) modal.style.display = 'none';
      carregarHistorico();
    }, 2000);
  } catch (e) {
    if (status) { status.style.color = '#f09080'; status.textContent = 'Erro: ' + (e.message || 'falha ao enviar'); }
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

// ── Partidas de outros onde o usuário aparece como jogador ────────

async function _carregarPartidasComoParticipante(section, user, sb) {
  const nome = user.user_metadata?.display_name || user.user_metadata?.full_name;
  if (!nome) return;

  try {
    const { data, error } = await sb
      .from('partidas_liga')
      .select('*')
      .neq('user_id', user.id)
      .eq('status', 'aprovada')
      .contains('dados', { jogadores: [{ nome }] })
      .order('criado_em', { ascending: false })
      .limit(30);

    if (error || !data?.length) return;

    // Remove seção anterior caso carregarHistorico tenha sido chamado duas vezes
    document.getElementById('participanteSection')?.remove();

    const div = document.createElement('div');
    div.id = 'participanteSection';
    div.innerHTML = `
      <div class="section" style="margin-top:1rem;">
        <div class="section-title">✓ Partidas Aprovadas como Participante (${data.length})</div>
        ${data.map(p => _renderCardParticipante(p, nome)).join('')}
      </div>`;
    section.appendChild(div);
  } catch { /* silencioso */ }
}

function _renderCardParticipante(p, nomeUsuario) {
  const d = p.dados || {};
  const jogadores = d.jogadores || [];
  const vencedor  = jogadores.find(j => j.vencedor);
  const eu        = jogadores.find(j => j.nome === nomeUsuario);

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
      <span class="liga-badge badge-aprovada">✓ Aprovada</span>
      ${d.mapa ? `<div class="hist-mapa">🗺️ ${d.mapa}</div>` : ''}
      ${vencedor ? `<div class="hist-vencedor">🏆 ${vencedor.nome} — ${vencedor.faccao}</div>` : ''}
      ${eu ? `<div style="margin-top:6px;font-family:sans-serif;font-size:0.78rem;color:var(--text2);">
        Sua facção: <strong>${eu.faccao || '—'}</strong>${eu.pontuacao != null ? ' · ' + eu.pontuacao + ' pts' : ''}${eu.vencedor ? ' 🏆' : ''}
      </div>` : ''}
      <div class="hist-jogadores" style="margin-top:6px;">
        ${jogadores.map(j => `
          <span class="hist-jogador${j.vencedor ? ' hist-vencedor-tag' : ''}">
            ${j.nome}${j.nome === nomeUsuario ? ' <em style="color:var(--text3);font-style:normal;font-size:0.72em;">(você)</em>' : ''}${j.faccao ? ' · ' + j.faccao : ''}${j.pontuacao != null ? ' · ' + j.pontuacao + 'pts' : ''}
          </span>`).join('')}
      </div>
      ${_renderFotosLiga(p)}
      <div style="font-family:sans-serif;font-size:0.7rem;color:var(--text3);margin-top:8px;">
        Enviada por: ${d.submitter_name || '—'}
      </div>
    </div>`;
}
