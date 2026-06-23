// ===================== AUTENTICAÇÃO SUPABASE =====================

const SUPABASE_URL = 'https://pgfkwumbtzarohkiqcen.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_W-PlyMDuen4vNawLs0y1IA_yNT3S-w8';

// Carrega o SDK do Supabase dinamicamente
let supabaseClient = null;

async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  const module = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const createClient = module.createClient;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,  // handles OAuth callback automatically
    }
  });

  // Listener de mudança de sessão
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    renderAuthUI();
    if (event === 'SIGNED_IN') {
      hideAuthModal();
      carregarPerfil(session.user.id);
      // Salva dados de contato pendentes (do cadastro via Ludopedia/Google)
      const pendingWA = localStorage.getItem('pending_whatsapp');
      if (pendingWA && currentUser) {
        localStorage.removeItem('pending_whatsapp');
        initSupabase().then(sb => sb.auth.updateUser({ data: { whatsapp: pendingWA } }).then(() => {
          if (currentUser?.user_metadata) currentUser.user_metadata.whatsapp = pendingWA;
        }));
      }
      if (typeof restoreTabFromHash === 'function') restoreTabFromHash();
      if (typeof carregarHistorico === 'function') carregarHistorico();
      // Inicia Ludopedia e depois pré-preenche o slot do próprio usuário
      if (typeof initLudopedia === 'function') {
        initLudopedia().then(() => {
          if (typeof carregarJogadoresCadastrados === 'function') carregarJogadoresCadastrados();
          if (typeof preencherSlotProprio === 'function') preencherSlotProprio();
          setTimeout(() => { if (typeof verificarVinculacaoJogador === 'function') verificarVinculacaoJogador(); }, 1500);
        });
      } else {
        if (typeof carregarJogadoresCadastrados === 'function') carregarJogadoresCadastrados();
        if (typeof preencherSlotProprio === 'function') preencherSlotProprio();
        setTimeout(() => { if (typeof verificarVinculacaoJogador === 'function') verificarVinculacaoJogador(); }, 1500);
      }
    }
    if (event === 'SIGNED_OUT') {
      currentUserRole = 'jogador';
      _renderTabEmbaixador();
      // Limpa sessão Ludopedia da memória
      if (typeof ludoToken !== 'undefined') { ludoToken = null; }
      if (typeof ludoUser  !== 'undefined') { ludoUser  = null; }
      localStorage.removeItem('ludo_token');
      if (typeof renderHistoricoLogout === 'function') renderHistoricoLogout();
      if (typeof renderLudopediaStatus === 'function') renderLudopediaStatus();
      if (typeof resetSlotProprio === 'function') resetSlotProprio();
    }
  });

  // Verifica sessão atual (inclui OAuth callback)
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUser = session?.user || null;
  renderAuthUI();

  // Se voltou de OAuth redirect, limpa o hash da URL
  if (window.location.hash.includes('access_token') || window.location.hash.includes('error')) {
    history.replaceState(null, '', window.location.pathname);
  }

  return supabaseClient;
}

let currentUser = null;
let currentUserRole = 'jogador';

async function carregarPerfil(userId) {
  try {
    const sb = await initSupabase();
    const { data } = await sb.from('perfis').select('role').eq('user_id', userId).single();
    currentUserRole = data?.role || 'jogador';
  } catch { currentUserRole = 'jogador'; }
  _renderTabEmbaixador();
}

function _renderTabEmbaixador() {
  const tab = document.getElementById('tabAprovacoes');
  if (!tab) return;
  tab.style.display = (currentUserRole === 'embaixador' || currentUserRole === 'admin') ? '' : 'none';
}

// ── Login ────────────────────────────────────────────────────────
async function loginGoogle() {
  const wa = document.getElementById('authWhatsApp')?.value?.trim();
  if (wa) localStorage.setItem('pending_whatsapp', wa);
  const sb = await initSupabase();
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { access_type: 'offline', prompt: 'consent' }
    }
  });
}

function loginLudopediaWithPending() {
  const wa = document.getElementById('authWhatsApp')?.value?.trim();
  if (wa) localStorage.setItem('pending_whatsapp', wa);
  if (typeof conectarLudopedia === 'function') conectarLudopedia();
}

async function loginEmail(email, senha) {
  const sb = await initSupabase();
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}

async function logout() {
  const sb = await initSupabase();
  await sb.auth.signOut();
}

// Detecta retorno de redirect OAuth do Supabase (não da Ludopedia)
(function () {
  const p = new URLSearchParams(window.location.search);
  if (p.has('code') && !localStorage.getItem('ludo_connecting')) {
    const btn = document.getElementById('authBtn');
    if (btn) { btn.textContent = '⏳ Conectando...'; btn.disabled = true; btn.style.opacity = '0.7'; }
  }
})();

// ── UI de autenticação ───────────────────────────────────────────
function renderAuthUI() {
  const btn         = document.getElementById('authBtn');
  const cadastrarBtn = document.getElementById('cadastrarBtn');
  const userInfo    = document.getElementById('userInfo');
  if (!btn) return;

  if (currentUser) {
    const nome   = currentUser.user_metadata?.display_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuário';
    const avatar = currentUser.user_metadata?.avatar_url;
    const temLudo  = (typeof ludoToken !== 'undefined') && ludoToken;

    btn.style.display = 'none';
    if (cadastrarBtn) cadastrarBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    userInfo.innerHTML = `
      <button onclick="abrirModalPerfil()" style="display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;padding:0;max-width:160px;" title="Ver perfil">
        <div style="position:relative;flex-shrink:0;">
          ${avatar
            ? `<img src="${avatar}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">`
            : `<div style="width:30px;height:30px;border-radius:50%;background:var(--surface2);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1rem;">👤</div>`}
          ${temLudo ? `<span style="position:absolute;bottom:-2px;right:-2px;width:13px;height:13px;background:#3a8a28;border-radius:50%;border:2px solid var(--surface);font-size:0.45rem;display:flex;align-items:center;justify-content:center;">🎲</span>` : ''}
        </div>
        <span style="font-size:0.82rem;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nome}</span>
      </button>
      <button onclick="logout()" style="background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text3);font-size:0.72rem;padding:3px 8px;cursor:pointer;flex-shrink:0;">Sair</button>
    `;
  } else {
    btn.style.display = 'flex';
    if (cadastrarBtn) cadastrarBtn.style.display = '';
    userInfo.style.display = 'none';
    userInfo.innerHTML = '';
  }
}

// ── Modal de perfil ──────────────────────────────────────────────
async function abrirModalPerfil() {
  const modal = document.getElementById('modalJogadores');
  if (!modal || !currentUser) return;

  const displayName = currentUser.user_metadata?.display_name || '';
  const nome    = displayName || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Usuário';
  const avatar  = currentUser.user_metadata?.avatar_url;
  const email   = currentUser.email || '';
  const userId  = currentUser.id;
  const whatsapp = currentUser.user_metadata?.whatsapp || '';
  const temLudo   = (typeof ludoToken !== 'undefined') && ludoToken;
  const ludoNome  = temLudo ? ((typeof ludoUser !== 'undefined') ? (ludoUser?.usuario || ludoUser?.nm_usuario || '—') : '—') : null;
  const ludoIdNum = (typeof ludoUser !== 'undefined') ? ludoUser?.id_usuario : null;

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box perfil-modal" style="max-width:360px;width:95%;">
      <div class="modal-header" style="justify-content:flex-end;margin-bottom:0.5rem;">
        <button onclick="fecharGerenciarJogadores()" class="modal-close-btn">×</button>
      </div>

      <!-- Avatar + nome -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:1rem;">
        <div style="position:relative;flex-shrink:0;">
          ${avatar
            ? `<img src="${avatar}" style="width:54px;height:54px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">`
            : `<div style="width:54px;height:54px;border-radius:50%;background:var(--surface2);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.6rem;">👤</div>`}
          ${temLudo ? `<span class="perfil-ludo-dot">🎲</span>` : ''}
        </div>
        <div style="min-width:0;">
          <div style="font-size:1rem;font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nome}</div>
          <div style="font-size:0.73rem;color:var(--text3);font-family:sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${email}</div>
        </div>
      </div>

      <!-- Nome de exibição -->
      <div class="perfil-section">
        <div class="perfil-section-label">NOME DE EXIBIÇÃO</div>
        <p style="font-family:sans-serif;font-size:0.73rem;color:var(--text3);margin:0 0 6px;line-height:1.4;">
          Nome que aparece nos slots de jogador ao sortear.
        </p>
        <div style="display:flex;gap:6px;">
          <input id="perfilDisplayName" type="text" value="${displayName}"
            placeholder="${currentUser.user_metadata?.full_name || 'Seu nome'}"
            style="flex:1;font-size:0.85rem;">
          <button class="ludo-btn-sm" style="white-space:nowrap;" onclick="_salvarNomeExibicao()">Salvar</button>
        </div>
        <div id="perfilDisplayNameStatus" style="font-size:0.72rem;min-height:14px;margin-top:4px;font-family:sans-serif;"></div>
      </div>

      <!-- WhatsApp -->
      <div class="perfil-section">
        <div class="perfil-section-label">WHATSAPP</div>
        <div style="display:flex;gap:6px;">
          <input id="perfilWhatsApp" type="tel" value="${whatsapp}"
            placeholder="Ex: 11999998888"
            style="flex:1;font-size:0.85rem;">
          <button class="ludo-btn-sm" style="white-space:nowrap;" onclick="_salvarWhatsApp()">Salvar</button>
        </div>
        <div id="perfilWhatsAppStatus" style="font-size:0.72rem;min-height:14px;margin-top:4px;font-family:sans-serif;"></div>
      </div>

      <!-- Ludopedia -->
      <div class="perfil-section">
        <div class="perfil-section-label">LUDOPEDIA</div>
        ${temLudo ? `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.4rem;">🎲</span>
            <div style="flex:1;min-width:0;">
              <div style="font-family:sans-serif;font-size:0.9rem;color:#80d060;font-weight:600;">${ludoNome}</div>
              ${ludoIdNum ? `<div style="font-family:sans-serif;font-size:0.68rem;color:var(--text3);">ID Ludopedia: ${ludoIdNum}</div>` : ''}
            </div>
            <button class="ludo-btn-sm" style="color:#f09080;border-color:rgba(240,144,128,0.3);flex-shrink:0;" onclick="desconectarLudopedia();fecharGerenciarJogadores();">Desconectar</button>
          </div>` : `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span style="font-family:sans-serif;font-size:0.82rem;color:var(--text3);">Conta não conectada</span>
            <button class="ludo-btn-sm" onclick="fecharGerenciarJogadores();conectarLudopedia();">Conectar 🎲</button>
          </div>`}
      </div>

      <!-- QR Code -->
      <div class="perfil-section perfil-qr-section">
        <div class="perfil-section-label">MEU CÓDIGO DE JOGADOR</div>
        <p style="font-family:sans-serif;font-size:0.75rem;color:var(--text3);margin:0 0 10px;line-height:1.4;">
          Peça ao organizador da partida para escanear este QR ou compartilhe seu ID para ser adicionado.
        </p>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <div class="perfil-qr-frame">
            <div id="perfilQRBox"></div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;justify-content:center;min-width:0;">
            <div style="font-family:sans-serif;font-size:0.7rem;color:var(--text3);">SEU ID</div>
            <div style="font-family:monospace;font-size:0.68rem;color:var(--text2);word-break:break-all;background:var(--surface);padding:6px 8px;border-radius:6px;border:1px solid var(--border);">${userId}</div>
            <button class="btn-sortear" style="font-size:0.78rem;padding:0.4rem;" onclick="navigator.clipboard.writeText('${userId}').then(()=>{this.textContent='✓ Copiado!';setTimeout(()=>this.textContent='📋 Copiar ID',1500)})">📋 Copiar ID</button>
          </div>
        </div>
      </div>

      ${currentUserRole === 'admin' ? `
      <!-- Painel Admin -->
      <div class="perfil-section">
        <div class="perfil-section-label">ADMINISTRAÇÃO</div>
        <p style="font-family:sans-serif;font-size:0.73rem;color:var(--text3);margin:0 0 8px;line-height:1.4;">
          Cole o ID do usuário (botão "Copiar ID" no perfil dele) e selecione o papel.
        </p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <input id="adminUserId" type="text" placeholder="ID do usuário (UUID)"
            style="flex:1;min-width:0;font-size:0.75rem;font-family:monospace;">
          <select id="adminRole" style="flex-shrink:0;font-size:0.82rem;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:0.4rem 0.6rem;color:var(--text);">
            <option value="embaixador">Embaixador</option>
            <option value="jogador">Jogador</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button class="ludo-btn-sm" onclick="_salvarRoleAdmin()">Salvar</button>
        </div>
        <div id="adminStatus" style="font-family:sans-serif;font-size:0.72rem;min-height:14px;margin-top:4px;"></div>
        <div id="adminListaEmbaixadores" style="margin-top:10px;"></div>
      </div>` : ''}

      <button onclick="logout();fecharGerenciarJogadores();" class="perfil-logout-btn">Sair da conta</button>
    </div>`;

  // Gera QR Code com o ID do usuário
  if (typeof _gerarQRCode === 'function') {
    await _gerarQRCode('perfilQRBox', `https://root-ligasp.vercel.app/?pid=${userId}`, 118);
  }

  if (currentUserRole === 'admin') _carregarListaRoles();
}

async function _salvarNomeExibicao() {
  const inp = document.getElementById('perfilDisplayName');
  const el  = document.getElementById('perfilDisplayNameStatus');
  const nome = inp?.value?.trim();
  if (!el) return;
  el.style.color = 'var(--text3)'; el.textContent = 'Salvando...';
  try {
    const sb = await initSupabase();
    const { error } = await sb.auth.updateUser({ data: { display_name: nome || null } });
    if (error) throw error;
    // Atualiza currentUser em memória
    if (currentUser?.user_metadata) currentUser.user_metadata.display_name = nome || undefined;
    el.style.color = '#80d060'; el.textContent = '✓ Salvo';
    renderAuthUI();
    setTimeout(() => { if (el) el.textContent = ''; }, 2000);
  } catch (e) {
    el.style.color = '#f09080'; el.textContent = 'Erro: ' + e.message;
  }
}

let _authMode = 'entrar';

function setAuthMode(mode) {
  _authMode = mode;
  const isEntrar = mode === 'entrar';
  const tabEntrar    = document.getElementById('authTabEntrar');
  const tabCadastrar = document.getElementById('authTabCadastrar');
  const submitBtn    = document.getElementById('authSubmitBtn');
  const extraFields  = document.getElementById('authCadastroExtra');
  const subtitle     = document.getElementById('authSubtitle');
  if (tabEntrar)    tabEntrar.classList.toggle('active', isEntrar);
  if (tabCadastrar) tabCadastrar.classList.toggle('active', !isEntrar);
  if (submitBtn)    submitBtn.textContent = isEntrar ? 'Entrar' : 'Criar conta';
  if (extraFields)  extraFields.style.display = isEntrar ? 'none' : 'flex';
  if (subtitle)     subtitle.textContent = isEntrar
    ? 'Entre para salvar o histórico das suas partidas'
    : 'Crie sua conta para participar da Liga Root SP';
  const authMsg = document.getElementById('authMsg');
  if (authMsg) { authMsg.textContent = ''; authMsg.style.display = 'none'; }
}

function showAuthModal(mode = 'entrar') {
  document.getElementById('authModal').style.display = 'flex';
  setAuthMode(mode);
}
function hideAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function showAuthMsg(msg, isError = false) {
  const el = document.getElementById('authMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#f09080' : '#80d060';
  el.style.display = 'block';
}

async function submitEmailLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const senha = document.getElementById('authSenha').value;
  if (!email || !senha) { showAuthMsg('Preencha email e senha.', true); return; }
  try {
    await loginEmail(email, senha);
    hideAuthModal();
  } catch(e) {
    showAuthMsg(e.message || 'Email ou senha incorretos.', true);
  }
}

async function submitEmailRegister() {
  const email = document.getElementById('authEmail').value.trim();
  const senha = document.getElementById('authSenha').value;
  const wa    = document.getElementById('authWhatsApp')?.value?.trim();
  if (!email || !senha) { showAuthMsg('Preencha email e senha.', true); return; }
  if (senha.length < 6)  { showAuthMsg('Senha deve ter mínimo 6 caracteres.', true); return; }
  try {
    const sb = await initSupabase();
    const opts = wa ? { data: { whatsapp: wa } } : {};
    const { error } = await sb.auth.signUp({ email, password: senha, options: opts });
    if (error) throw error;
    showAuthMsg('Conta criada! Verifique seu email para confirmar.');
  } catch(e) {
    showAuthMsg(e.message || 'Erro ao criar conta.', true);
  }
}

async function _submitAuthEmail() {
  if (_authMode === 'cadastrar') await submitEmailRegister();
  else await submitEmailLogin();
}

async function _salvarWhatsApp() {
  const inp = document.getElementById('perfilWhatsApp');
  const el  = document.getElementById('perfilWhatsAppStatus');
  const wa  = inp?.value?.trim();
  if (!el) return;
  el.style.color = 'var(--text3)'; el.textContent = 'Salvando...';
  try {
    const sb = await initSupabase();
    const { error } = await sb.auth.updateUser({ data: { whatsapp: wa || null } });
    if (error) throw error;
    if (currentUser?.user_metadata) currentUser.user_metadata.whatsapp = wa || undefined;
    el.style.color = '#80d060'; el.textContent = '✓ Salvo';
    setTimeout(() => { if (el) el.textContent = ''; }, 2000);
  } catch (e) {
    el.style.color = '#f09080'; el.textContent = 'Erro: ' + e.message;
  }
}

// ── Painel Admin ──────────────────────────────────────────────────

async function _salvarRoleAdmin() {
  const uid  = document.getElementById('adminUserId')?.value?.trim();
  const role = document.getElementById('adminRole')?.value;
  const el   = document.getElementById('adminStatus');
  if (!uid) { if (el) { el.style.color = '#f09080'; el.textContent = 'Cole o ID do usuário.'; } return; }
  if (el) { el.style.color = 'var(--text3)'; el.textContent = 'Salvando...'; }
  try {
    const sb = await initSupabase();
    const { error } = await sb.from('perfis')
      .upsert({ user_id: uid, role }, { onConflict: 'user_id' });
    if (error) throw error;
    if (el) { el.style.color = '#80d060'; el.textContent = `✓ ${uid.slice(0,8)}... definido como ${role}.`; }
    const inp = document.getElementById('adminUserId');
    if (inp) inp.value = '';
    _carregarListaRoles();
  } catch (e) {
    if (el) { el.style.color = '#f09080'; el.textContent = 'Erro: ' + e.message; }
  }
}

async function _carregarListaRoles() {
  const el = document.getElementById('adminListaEmbaixadores');
  if (!el) return;
  try {
    const sb = await initSupabase();
    const { data } = await sb.from('perfis').select('*').neq('role', 'jogador').order('role');
    if (!data?.length) {
      el.innerHTML = '<div style="font-family:sans-serif;font-size:0.72rem;color:var(--text3);">Nenhum embaixador cadastrado.</div>';
      return;
    }
    el.innerHTML = `
      <div style="font-family:sans-serif;font-size:0.7rem;color:var(--text3);margin-bottom:4px;letter-spacing:0.05em;text-transform:uppercase;">Embaixadores & Admins</div>
      ${data.map(p => `
        <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border);">
          <span class="liga-badge ${p.role === 'admin' ? 'badge-aprovada' : 'badge-pendente'}" style="flex-shrink:0;">${p.role}</span>
          <span style="font-size:0.67rem;color:var(--text3);font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.user_id}</span>
          ${p.user_id !== currentUser?.id ? `
            <button onclick="_removerRoleAdmin('${p.user_id}')"
              style="background:transparent;border:1px solid rgba(200,64,40,0.4);border-radius:4px;color:#f08070;font-size:0.67rem;padding:2px 6px;cursor:pointer;flex-shrink:0;">
              Remover
            </button>` : '<span style="font-size:0.67rem;color:var(--text3);flex-shrink:0;">(você)</span>'}
        </div>`).join('')}`;
  } catch { el.innerHTML = ''; }
}

async function _removerRoleAdmin(uid) {
  try {
    const sb = await initSupabase();
    const { error } = await sb.from('perfis')
      .upsert({ user_id: uid, role: 'jogador' }, { onConflict: 'user_id' });
    if (error) throw error;
    _carregarListaRoles();
  } catch (e) { alert('Erro: ' + e.message); }
}