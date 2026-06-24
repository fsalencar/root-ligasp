// Painel de administração — visível apenas para admin e super_user

let _adminUsuarios = [];
let _adminFiltro = '';

async function carregarAdmin() {
  const section = document.getElementById('tab-admin');
  if (!section) return;
  if (!currentUser) {
    section.innerHTML = '<div class="section" style="text-align:center;padding:2rem;"><div style="font-family:sans-serif;color:var(--text3);">Login necessário.</div></div>';
    return;
  }

  section.innerHTML = '<div class="section" style="text-align:center;padding:2rem;"><div style="font-family:sans-serif;color:var(--text3);">Carregando usuários...</div></div>';

  try {
    const sb = await initSupabase();
    const { data, error } = await sb.rpc('get_all_users_for_admin');
    if (error) throw error;
    _adminUsuarios = data || [];
    _renderAdmin(section);
  } catch (e) {
    section.innerHTML = `<div class="section"><div style="text-align:center;padding:2rem;font-family:sans-serif;color:#f09080;">Erro: ${e.message}</div></div>`;
  }
}

function _renderAdmin(section) {
  section.innerHTML = `
    <div class="section">
      <div class="section-title">Gerenciar Jogadores (${_adminUsuarios.length})</div>
      <input type="text" id="adminSearch" placeholder="Buscar por nome ou email..."
        oninput="_filtrarAdmin(this.value)"
        style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.5rem 0.75rem;color:var(--text);font-family:sans-serif;font-size:0.85rem;margin-bottom:1rem;box-sizing:border-box;">
      <div id="adminUserList"></div>
    </div>`;
  _filtrarAdmin('');
}

function _filtrarAdmin(filtro) {
  _adminFiltro = (filtro || '').toLowerCase();
  const el = document.getElementById('adminUserList');
  if (!el) return;

  const lista = _adminFiltro
    ? _adminUsuarios.filter(u =>
        (u.email || '').toLowerCase().includes(_adminFiltro) ||
        (u.display_name || '').toLowerCase().includes(_adminFiltro))
    : _adminUsuarios;

  if (!lista.length) {
    el.innerHTML = '<div style="font-family:sans-serif;font-size:0.82rem;color:var(--text3);text-align:center;padding:1rem;">Nenhum usuário encontrado.</div>';
    return;
  }

  el.innerHTML = lista.map(u => _renderAdminRow(u)).join('');
}

const _ADMIN_ROLE_BADGE = {
  super_user: '<span class="liga-badge badge-aprovada">⭐ Super User</span>',
  admin:      '<span class="liga-badge badge-revisao">🔑 Admin</span>',
  embaixador: '<span class="liga-badge badge-pendente">🛡 Embaixador</span>',
  jogador:    '<span class="liga-badge" style="background:var(--surface2);color:var(--text3);border:1px solid var(--border);">Jogador</span>',
};

function _renderAdminRow(u) {
  const isSelf       = u.id === currentUser?.id;
  const isSuperUser  = currentUserRole === 'super_user';
  const targetIsSuperUser = u.role === 'super_user';
  const badge = _ADMIN_ROLE_BADGE[u.role] || _ADMIN_ROLE_BADGE['jogador'];

  let acoes = '';

  if (!isSelf && !targetIsSuperUser) {
    if (isSuperUser) {
      // Super user: pode definir jogador, embaixador ou admin (nunca super_user via UI)
      const opcoes = ['jogador', 'embaixador', 'admin'].filter(r => r !== u.role);
      acoes = opcoes.map(r => `
        <button onclick="_definirRole('${u.id}','${r}')"
          class="btn-copiar" style="font-size:0.72rem;padding:3px 9px;${_estiloAcao(r)}">
          ${_iconeRole(r)} ${_labelRole(r)}
        </button>`).join('');
    } else {
      // Admin: pode alternar jogador ↔ embaixador (não toca em outros admins)
      if (u.role === 'admin') {
        // Admin não pode tocar em outro admin
        acoes = '';
      } else if (u.role === 'embaixador') {
        acoes = `<button onclick="_definirRole('${u.id}','jogador')"
          class="btn-copiar" style="font-size:0.72rem;padding:3px 9px;">
          👤 Remover Embaixador</button>`;
      } else {
        acoes = `<button onclick="_definirRole('${u.id}','embaixador')"
          class="btn-copiar" style="font-size:0.72rem;padding:3px 9px;background:rgba(200,160,80,0.15);border-color:rgba(200,160,80,0.4);color:var(--gold);">
          🛡 Tornar Embaixador</button>`;
      }
    }
  }

  return `
    <div class="hist-card" id="admin-row-${u.id}" style="padding:10px 14px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <div style="font-family:sans-serif;font-size:0.88rem;color:var(--text1);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${u.display_name || '—'}${isSelf ? ' <span style="color:var(--text3);font-size:0.72rem;font-weight:normal;">(você)</span>' : ''}
          </div>
          <div style="font-family:sans-serif;font-size:0.72rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.email || ''}</div>
        </div>
        ${badge}
      </div>
      ${acoes ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">${acoes}</div>` : ''}
    </div>`;
}

function _estiloAcao(role) {
  if (role === 'embaixador') return 'background:rgba(200,160,80,0.15);border-color:rgba(200,160,80,0.4);color:var(--gold);';
  if (role === 'admin')      return 'background:var(--blue-bg);border-color:rgba(48,112,200,0.4);color:#70a8f0;';
  return '';
}

function _iconeRole(role) {
  return { embaixador: '🛡', admin: '🔑', jogador: '👤' }[role] || '';
}

function _labelRole(role) {
  return { super_user: 'Super User', admin: 'Admin', embaixador: 'Embaixador', jogador: 'Jogador' }[role] || role;
}

async function _definirRole(uid, novoRole) {
  const row = document.getElementById('admin-row-' + uid);
  if (row) row.style.opacity = '0.5';
  try {
    const sb = await initSupabase();
    const { data: { session } } = await sb.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Sessão inválida');

    const res = await fetch('/api/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify({ target_user_id: uid, role: novoRole }),
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { throw new Error('Resposta inválida: ' + text.slice(0, 200)); }
    if (!res.ok) throw new Error(data.error || 'Erro ao definir role');

    const u = _adminUsuarios.find(x => x.id === uid);
    if (u) u.role = novoRole;
    _filtrarAdmin(_adminFiltro);
  } catch (e) {
    if (row) row.style.opacity = '1';
    alert('Erro: ' + e.message);
  }
}
