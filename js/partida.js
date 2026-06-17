// Partida em andamento

let partidaAtual = null;

function criarPartida(facResult, nomes, mapa, deck) {
  const jogadores = facResult.setupOrder.map((fac, i) => ({
    nome: nomes[i] || `Jogador ${i + 1}`,
    faccao: fac.name,
    faccaoId: fac.id,
    tipo: fac.type,
  }));

  // Mapeia ordem de turno de volta para nomes de jogadores
  const turnOrder = facResult.turnOrder.map(fac => {
    const idx = facResult.setupOrder.indexOf(fac);
    return idx >= 0 ? (nomes[idx] || `Jogador ${idx + 1}`) : fac.name;
  });

  partidaAtual = {
    jogadores,
    mapa: mapa.name,
    mapaIcon: mapa.icon,
    deck: deck || null,
    turnOrder,
    inicio: new Date().toISOString(),
  };

  localStorage.setItem('partidaAtual', JSON.stringify(partidaAtual));
  if (document.getElementById('tab-partida')?.classList.contains('active')) {
    renderPartida();
  }
}

function finalizarPartida(jogadoresFinais) {
  const local = document.getElementById('ligaLocal')?.value?.trim() || '';
  const dataVal = document.getElementById('ligaData')?.value || '';
  const mapaForm = document.getElementById('ligaMapa')?.value || '';

  const resultado = {
    local,
    data: dataVal,
    mapa: mapaForm || (partidaAtual?.mapa || ''),
    jogadores: jogadoresFinais,
    criadoEm: new Date().toISOString(),
  };

  if (typeof currentUser !== 'undefined' && currentUser) {
    salvarHistoricoSupabase(resultado);
  }

  localStorage.removeItem('partidaAtual');
  partidaAtual = null;
  atualizarBadgePartida(false);
  renderPartida();
}

async function salvarHistoricoSupabase(resultado) {
  try {
    const sb = await initSupabase();
    await sb.from('historico').insert({
      user_id: currentUser.id,
      dados: resultado,
      criado_em: resultado.criadoEm,
    });
    if (typeof carregarHistorico === 'function') {
      if (document.getElementById('tab-historico')?.classList.contains('active')) {
        carregarHistorico();
      }
    }
  } catch (e) {
    console.warn('Erro ao salvar histórico:', e);
  }
}

function restaurarPartidaSeExistir() {
  const saved = localStorage.getItem('partidaAtual');
  if (!saved) return;
  try {
    partidaAtual = JSON.parse(saved);
    atualizarBadgePartida(true);
  } catch (e) {
    localStorage.removeItem('partidaAtual');
  }
}

function atualizarBadgePartida(ativa) {
  const btn = document.querySelector('.liga-tab[data-tab="partida"]');
  if (!btn) return;
  let badge = btn.querySelector('.tab-badge');
  if (ativa) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'tab-badge';
      btn.appendChild(badge);
    }
  } else {
    if (badge) badge.remove();
  }
}

function renderPartida() {
  const section = document.getElementById('tab-partida');
  if (!section) return;

  if (!partidaAtual) {
    section.innerHTML = `
      <div class="section" style="text-align:center;padding:2.5rem 2rem;">
        <div style="font-size:2.5rem;margin-bottom:1rem;">🎮</div>
        <div style="font-size:1rem;color:var(--text2);font-family:sans-serif;">Nenhuma partida em andamento</div>
        <div style="font-size:0.82rem;color:var(--text3);font-family:sans-serif;margin-top:0.5rem;line-height:1.5;">
          Faça um sorteio na aba ⚔ Sorteio para começar.
        </div>
      </div>`;
    return;
  }

  const { jogadores, mapa, mapaIcon, deck, turnOrder, inicio } = partidaAtual;
  const dataInicio = inicio ? new Date(inicio).toLocaleDateString('pt-BR') : '';

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Partida em Andamento</div>

      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;align-items:center;">
        ${mapaIcon ? `<span style="font-size:1.8rem;line-height:1;">${mapaIcon}</span>` : ''}
        <div>
          <div style="font-size:1rem;color:var(--text);">${mapa}</div>
          ${deck ? `<div style="font-size:0.78rem;color:var(--text3);font-family:sans-serif;">🃏 ${deck}</div>` : ''}
          ${dataInicio ? `<div style="font-size:0.75rem;color:var(--text3);font-family:sans-serif;margin-top:2px;">📅 ${dataInicio}</div>` : ''}
        </div>
      </div>

      <div class="section-title">Ordem de Setup</div>
      ${jogadores.map((j, i) => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;background:var(--surface2);">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--surface);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:0.78rem;color:var(--text3);font-family:sans-serif;flex-shrink:0;font-weight:bold;">${i + 1}</div>
          <div style="flex:1;">
            <div style="font-size:0.9rem;color:var(--text);">${j.nome}</div>
            <div style="font-size:0.75rem;font-family:sans-serif;">
              <span style="color:var(--text3);">${j.faccao}</span>
              <span style="margin-left:6px;color:${j.tipo === 'militant' ? '#f09080' : '#80d060'};">${j.tipo === 'militant' ? 'Militante' : 'Insurgente'}</span>
            </div>
          </div>
        </div>
      `).join('')}

      ${turnOrder && turnOrder.length > 0 ? `
        <div class="section-title" style="margin-top:1.25rem;">Ordem de Turno</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${turnOrder.map((nome, i) => `
            <div style="padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;font-size:0.82rem;font-family:sans-serif;color:var(--text2);">
              ${i + 1}. ${nome}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <button class="btn-resetar" onclick="encerrarPartida()" style="color:#f09080;border-color:rgba(200,64,40,0.25);">
      ✕ Encerrar partida sem salvar
    </button>`;
}

function encerrarPartida() {
  if (!confirm('Encerrar a partida em andamento sem salvar?')) return;
  localStorage.removeItem('partidaAtual');
  partidaAtual = null;
  atualizarBadgePartida(false);
  renderPartida();
}
