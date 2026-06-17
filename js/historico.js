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
  } catch (e) {
    renderHistoricoMensagem(section, '⚠️', 'Erro de conexão ao carregar histórico.');
    console.warn('Historico error:', e);
  }
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
      <div style="margin-top:10px;">
        <button class="btn-copiar" onclick="compartilharHistoricoWhatsApp('${entry.id}')" style="background:#25D366;color:white;font-size:0.75rem;">
          📲 WhatsApp
        </button>
      </div>
    </div>`;
}
