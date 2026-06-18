// ===================== CADASTRO DE JOGADORES =====================

let _jogadoresCadastrados = [];
// Mapa slot → dados Ludopedia do jogador selecionado { ludopedia_id, ludopedia_usuario }
const _playerLudoSlot = {};

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

async function salvarJogadorCadastrado({ id, nome, ludopedia_usuario, ludopedia_id }) {
  const sb = await initSupabase();
  if (id) {
    await sb.from('jogadores').update({ nome, ludopedia_usuario, ludopedia_id: ludopedia_id || null }).eq('id', id).eq('user_id', currentUser.id);
  } else {
    await sb.from('jogadores').insert({ user_id: currentUser.id, nome, ludopedia_usuario: ludopedia_usuario || null, ludopedia_id: ludopedia_id || null });
  }
  await carregarJogadoresCadastrados();
}

async function removerJogadorCadastrado(id) {
  const sb = await initSupabase();
  await sb.from('jogadores').delete().eq('id', id).eq('user_id', currentUser.id);
  await carregarJogadoresCadastrados();
}

// ── Autocomplete nos inputs de nome ──────────────────────────────────────────

function _fecharTodosDropdowns() {
  document.querySelectorAll('.jogador-dropdown').forEach(el => el.remove());
}

function attachPlayerAutocomplete(input, slotIndex) {
  input.setAttribute('autocomplete', 'off');

  input.addEventListener('focus', () => _mostrarDropdown(input, slotIndex));
  input.addEventListener('input',  () => _mostrarDropdown(input, slotIndex));

  input.addEventListener('blur', () => {
    // Delay para permitir clique no dropdown antes de fechar
    setTimeout(_fecharTodosDropdowns, 180);
  });
}

function _mostrarDropdown(input, slotIndex) {
  _fecharTodosDropdowns();
  if (!_jogadoresCadastrados.length) return;

  const q = input.value.toLowerCase();
  const matches = q
    ? _jogadoresCadastrados.filter(j => j.nome.toLowerCase().includes(q))
    : _jogadoresCadastrados;

  if (!matches.length) return;

  const dd = document.createElement('div');
  dd.className = 'jogador-dropdown';

  matches.forEach(j => {
    const item = document.createElement('div');
    item.className = 'jogador-dropdown-item';
    item.innerHTML = `
      <span class="jd-nome">${j.nome}</span>
      ${j.ludopedia_usuario ? `<span class="jd-ludo">🎲 ${j.ludopedia_usuario}</span>` : ''}`;
    item.addEventListener('mousedown', () => {
      input.value = j.nome;
      _playerLudoSlot[slotIndex] = j.ludopedia_id
        ? { ludopedia_id: j.ludopedia_id, ludopedia_usuario: j.ludopedia_usuario }
        : null;
      _fecharTodosDropdowns();
    });
    dd.appendChild(item);
  });

  // Posiciona abaixo do input
  const rect = input.getBoundingClientRect();
  dd.style.width = input.offsetWidth + 'px';
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(dd);
}

// Retorna dados Ludopedia do slot (ou null se for convidado)
function getLudoDataParaSlot(slotIndex) {
  return _playerLudoSlot[slotIndex] || null;
}

function resetPlayerLudoSlots() {
  Object.keys(_playerLudoSlot).forEach(k => delete _playerLudoSlot[k]);
}

// ── Modal de gerenciamento ────────────────────────────────────────────────────

function abrirGerenciarJogadores() {
  if (typeof currentUser === 'undefined' || !currentUser) {
    alert('Faça login para gerenciar jogadores cadastrados.');
    return;
  }
  _renderModalJogadores();
  document.getElementById('modalJogadores').style.display = 'flex';
}

function fecharGerenciarJogadores() {
  document.getElementById('modalJogadores').style.display = 'none';
}

function _renderModalJogadores() {
  const modal = document.getElementById('modalJogadores');
  const lista = _jogadoresCadastrados;

  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;width:95%;">
      <div class="modal-header">
        <span style="font-size:1rem;font-weight:600;color:var(--gold);">👥 Jogadores Cadastrados</span>
        <button onclick="fecharGerenciarJogadores()" style="background:none;border:none;color:var(--text3);font-size:1.3rem;cursor:pointer;line-height:1;">×</button>
      </div>

      <div id="listaJogadoresCadastrados" style="max-height:280px;overflow-y:auto;margin-bottom:1rem;">
        ${lista.length ? lista.map(j => _renderItemJogador(j)).join('') : `
          <div style="text-align:center;padding:1.5rem;font-family:sans-serif;color:var(--text3);font-size:0.85rem;">
            Nenhum jogador cadastrado ainda
          </div>`}
      </div>

      <div style="border-top:1px solid var(--border);padding-top:1rem;">
        <div style="font-size:0.8rem;color:var(--text3);font-family:sans-serif;margin-bottom:0.6rem;font-weight:600;">ADICIONAR JOGADOR</div>
        <input id="novoJogadorNome" type="text" placeholder="Nome do jogador" style="width:100%;margin-bottom:0.5rem;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:0.5rem;">
          <input id="novoJogadorLudoNick" type="text" placeholder="Username Ludopedia (opcional)" style="flex:1;">
          <button class="btn-sortear" style="padding:0.4rem 0.7rem;font-size:0.78rem;white-space:nowrap;" onclick="buscarLudoParaNovo()">Buscar</button>
        </div>
        <div id="novoJogadorLudoStatus" style="font-size:0.78rem;min-height:18px;margin-bottom:0.5rem;font-family:sans-serif;"></div>
        <input type="hidden" id="novoJogadorLudoId">
        <button class="btn-liga" style="width:100%;margin-top:0.25rem;" onclick="confirmarNovoJogador()">+ Adicionar</button>
      </div>
    </div>`;
}

function _renderItemJogador(j) {
  return `
    <div class="jogador-item" id="jitem_${j.id}">
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
        <span class="jitem-nome">${j.nome}</span>
        ${j.ludopedia_usuario
          ? `<span class="jitem-ludo">🎲 ${j.ludopedia_usuario}</span>`
          : `<span class="jitem-ludo" style="opacity:.4;">sem Ludopedia</span>`}
      </div>
      <button class="ludo-btn-sm" style="color:#f09080;border-color:rgba(240,144,128,0.3);" onclick="confirmarRemoverJogador('${j.id}','${j.nome.replace(/'/g, "\\'")}')">Remover</button>
    </div>`;
}

async function buscarLudoParaNovo() {
  const nick = document.getElementById('novoJogadorLudoNick')?.value?.trim();
  const el   = document.getElementById('novoJogadorLudoStatus');
  if (!nick || !el) return;

  el.style.color = 'var(--text3)';
  el.textContent = '⏳ Buscando...';

  try {
    const data = await buscarUsuarioLudo(nick);
    const u = data?.usuario || data;
    if (u?.id_usuario) {
      document.getElementById('novoJogadorLudoId').value = u.id_usuario;
      if (!document.getElementById('novoJogadorNome').value.trim()) {
        document.getElementById('novoJogadorNome').value = u.nm_usuario || nick;
      }
      el.style.color = '#80d060';
      el.textContent = `✓ Encontrado: ${u.nm_usuario || nick} (ID: ${u.id_usuario})`;
    } else {
      el.style.color = '#f09080';
      el.textContent = 'Usuário não encontrado na Ludopedia.';
    }
  } catch {
    el.style.color = '#f09080';
    el.textContent = 'Erro ao buscar usuário.';
  }
}

async function confirmarNovoJogador() {
  const nome  = document.getElementById('novoJogadorNome')?.value?.trim();
  const nick  = document.getElementById('novoJogadorLudoNick')?.value?.trim() || null;
  const ludoId = parseInt(document.getElementById('novoJogadorLudoId')?.value) || null;
  const el    = document.getElementById('novoJogadorLudoStatus');

  if (!nome) { if (el) { el.style.color = '#f09080'; el.textContent = 'Nome obrigatório.'; } return; }

  try {
    await salvarJogadorCadastrado({ nome, ludopedia_usuario: nick, ludopedia_id: ludoId });
    _renderModalJogadores();
  } catch (e) {
    if (el) { el.style.color = '#f09080'; el.textContent = 'Erro: ' + e.message; }
  }
}

async function confirmarRemoverJogador(id, nome) {
  if (!confirm(`Remover "${nome}" do cadastro?`)) return;
  await removerJogadorCadastrado(id);
  _renderModalJogadores();
}
