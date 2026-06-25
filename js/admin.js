// Painel de administração — visível apenas para admin e super_user

let _adminUsuarios = [];
let _adminFiltro = '';

const _ROLE_INFO = [
  { role: 'jogador',    icon: '👤', label: 'Jogador',    desc: 'Pode registrar partidas e ver o histórico.' },
  { role: 'embaixador', icon: '🛡', label: 'Embaixador', desc: 'Aprova e reprova partidas enviadas para a liga.' },
  { role: 'admin',      icon: '🔑', label: 'Admin',      desc: 'Gerencia embaixadores e jogadores. Acessa painel admin.' },
  { role: 'super_user', icon: '⭐', label: 'Super User', desc: 'Acesso total. Pode promover admins. Não pode ser alterado.' },
];

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
    const raw = data || [];
    // Deduplica por id (o RPC pode retornar duplicatas via JOIN)
    _adminUsuarios = raw.filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);
    _renderAdmin(section);
  } catch (e) {
    section.innerHTML = `<div class="section"><div style="text-align:center;padding:2rem;font-family:sans-serif;color:#f09080;">Erro: ${e.message}</div></div>`;
  }
}

function _renderAdmin(section) {
  const disclaimer = _ROLE_INFO.map(r => `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:1rem;flex-shrink:0;width:20px;text-align:center;">${r.icon}</span>
      <div>
        <span style="font-family:sans-serif;font-size:0.8rem;font-weight:600;color:var(--text1);">${r.label}</span>
        <span style="font-family:sans-serif;font-size:0.78rem;color:var(--text3);margin-left:6px;">${r.desc}</span>
      </div>
    </div>`).join('');

  section.innerHTML = `
    <div class="section">
      <div class="section-title">Papéis (Roles)</div>
      <div style="margin-bottom:1.25rem;">${disclaimer}</div>
    </div>
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
  jogador:    '<span class="liga-badge" style="background:var(--surface2);color:var(--text3);border:1px solid var(--border);">👤 Jogador</span>',
};

function _renderAdminRow(u) {
  const isSelf           = u.id === currentUser?.id;
  const isSuperUser      = currentUserRole === 'super_user';
  const targetIsSuperUser = u.role === 'super_user';
  const badge = _ADMIN_ROLE_BADGE[u.role] || _ADMIN_ROLE_BADGE['jogador'];
  const currentRole = u.role || 'jogador';

  // Quais roles o caller pode atribuir a este usuário
  let roleOptions = null;
  if (!isSelf && !targetIsSuperUser) {
    if (isSuperUser) {
      roleOptions = ['jogador', 'embaixador', 'admin'];
    } else {
      // Admin: só pode alternar entre jogador e embaixador (não toca em admin)
      if (currentRole !== 'admin') roleOptions = ['jogador', 'embaixador'];
    }
  }

  let seletor = '';
  if (roleOptions) {
    const opts = roleOptions.map(r => {
      const info = _ROLE_INFO.find(x => x.role === r);
      return `<option value="${r}" ${r === currentRole ? 'selected' : ''}>${info?.icon || ''} ${info?.label || r}</option>`;
    }).join('');

    seletor = `
      <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
        <select id="roleSelect-${u.id}"
          onchange="_onRoleSelectChange('${u.id}', '${currentRole}')"
          style="flex:1;min-width:140px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.4rem 0.6rem;color:var(--text);font-family:sans-serif;font-size:0.82rem;">
          ${opts}
        </select>
        <button id="roleBtn-${u.id}" onclick="_salvarRole('${u.id}')"
          disabled
          style="background:var(--gold);color:#1a1000;border:none;border-radius:var(--radius);padding:0.4rem 1rem;font-size:0.8rem;font-weight:600;cursor:pointer;opacity:0.4;white-space:nowrap;">
          Salvar
        </button>
        <span id="roleMsg-${u.id}" style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);"></span>
      </div>`;
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
      ${seletor}
    </div>`;
}

function _onRoleSelectChange(uid, currentRole) {
  const sel = document.getElementById('roleSelect-' + uid);
  const btn = document.getElementById('roleBtn-' + uid);
  const msg = document.getElementById('roleMsg-' + uid);
  if (!sel || !btn) return;
  const changed = sel.value !== currentRole;
  btn.disabled = !changed;
  btn.style.opacity = changed ? '1' : '0.4';
  if (msg) msg.textContent = '';
}

async function _salvarRole(uid) {
  const sel = document.getElementById('roleSelect-' + uid);
  const btn = document.getElementById('roleBtn-' + uid);
  const msg = document.getElementById('roleMsg-' + uid);
  if (!sel) return;

  const novoRole = sel.value;
  btn.disabled = true;
  btn.style.opacity = '0.5';
  btn.textContent = 'Salvando…';
  if (msg) { msg.style.color = 'var(--text3)'; msg.textContent = ''; }

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
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

    // Atualiza o estado local e re-renderiza a linha
    const u = _adminUsuarios.find(x => x.id === uid);
    if (u) u.role = novoRole;
    _filtrarAdmin(_adminFiltro);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Salvar'; }
    if (msg) { msg.style.color = '#f09080'; msg.textContent = 'Erro: ' + e.message; }
  }
}
